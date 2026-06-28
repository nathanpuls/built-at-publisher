export function createDomainSettingsHandlers({
  defaultDomain,
  json,
  normalizeDomain,
  requestDomain,
}) {
  function roundedFaviconUrl(settings = {}) {
    if (!settings.effectiveFaviconUrl) return "/favicon-v2.svg"

    const params = new URLSearchParams({ domain: settings.domain || defaultDomain })
    if (settings.updatedAt) params.set("v", settings.updatedAt)
    return `/api/domain-favicon-v2?${params}`
  }

  async function domainSettingsRow(env, domain) {
    return env.DB.prepare(
      "SELECT domain, favicon_url AS faviconUrl, updated_at AS updatedAt FROM domain_settings WHERE domain = ?"
    ).bind(domain).first()
  }

  async function getDomainSettings(env, domain = defaultDomain) {
    if (!env.DB) {
      return { domain: normalizeDomain(domain), faviconUrl: "" }
    }

    const normalizedDomain = normalizeDomain(domain)
    const row = await domainSettingsRow(env, normalizedDomain)
    const defaultRow = normalizedDomain === defaultDomain ? null : await domainSettingsRow(env, defaultDomain)

    const settings = row || { domain: normalizedDomain, faviconUrl: "", updatedAt: null }
    const inheritedFaviconUrl = !settings.faviconUrl ? defaultRow?.faviconUrl || "" : ""
    const effectiveFaviconUrl = settings.faviconUrl || inheritedFaviconUrl
    const effectiveUpdatedAt = settings.faviconUrl ? settings.updatedAt : defaultRow?.updatedAt || settings.updatedAt
    const history = await env.DB.prepare(
      `SELECT favicon_url AS faviconUrl, created_at AS createdAt
       FROM domain_favicon_history
       WHERE domain = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 5`
    ).bind(normalizedDomain).all()

    return {
      ...settings,
      inheritedFaviconUrl,
      effectiveFaviconUrl,
      faviconHref: roundedFaviconUrl({
        ...settings,
        effectiveFaviconUrl,
        updatedAt: effectiveUpdatedAt,
      }),
      recentFavicons: history.results || [],
    }
  }

  async function domainSettingsResponse(env, domain) {
    return json(await getDomainSettings(env, domain))
  }

  async function updateDomainSettings(request, env) {
    if (!env.DB) {
      return json({ error: "DB binding is not configured." }, { status: 500 })
    }

    const body = await request.json()
    const domain = normalizeDomain(body.domain)
    const faviconUrl = String(body.faviconUrl || "").trim()

    if (faviconUrl && !/^\/api\/media\/file\/|^https?:\/\//i.test(faviconUrl)) {
      return json({ error: "Favicon must be an uploaded image or an HTTP URL." }, { status: 400 })
    }

    const now = new Date().toISOString()
    await env.DB.prepare(
      `INSERT INTO domain_settings (domain, favicon_url, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(domain) DO UPDATE SET
        favicon_url = excluded.favicon_url,
        updated_at = excluded.updated_at`
    ).bind(domain, faviconUrl, now).run()

    if (faviconUrl) {
      await env.DB.prepare(
        `INSERT INTO domain_favicon_history (domain, favicon_url, created_at)
         SELECT ?, ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM domain_favicon_history
           WHERE domain = ? AND favicon_url = ?
         )`
      ).bind(domain, faviconUrl, now, domain, faviconUrl).run()

      await env.DB.prepare(
        `DELETE FROM domain_favicon_history
         WHERE domain = ? AND id NOT IN (
           SELECT id FROM domain_favicon_history
           WHERE domain = ?
           ORDER BY created_at DESC, id DESC
           LIMIT 5
         )`
      ).bind(domain, domain).run()
    }

    return domainSettingsResponse(env, domain)
  }

  function bytesToBase64(bytes) {
    let binary = ""
    const chunkSize = 0x8000

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
    }

    return btoa(binary)
  }

  async function renderDomainFavicon(request, env) {
    const url = new URL(request.url)
    const settings = await getDomainSettings(env, url.searchParams.get("domain") || requestDomain(request))

    const sourceUrl = settings.effectiveFaviconUrl || settings.faviconUrl

    if (!sourceUrl) {
      return env.ASSETS?.fetch(new Request(new URL("/favicon-v2.svg", request.url), request)) ||
        new Response("Not found", { status: 404 })
    }

    let contentType = "image/png"
    let bytes

    if (sourceUrl.startsWith("/api/media/file/")) {
      const key = decodeURIComponent(sourceUrl.replace(/^\/api\/media\/file\//, ""))
      const object = await env.MEDIA_BUCKET?.get(key)

      if (!object) {
        return new Response("Favicon source could not be loaded.", { status: 502 })
      }

      contentType = object.httpMetadata?.contentType || contentType
      bytes = new Uint8Array(await object.arrayBuffer())
    } else {
      const sourceResponse = await fetch(sourceUrl, {
        cf: { cacheTtl: 3600, cacheEverything: true },
      })

      if (!sourceResponse.ok) {
        return new Response("Favicon source could not be loaded.", { status: 502 })
      }

      contentType = sourceResponse.headers.get("content-type") || contentType
      bytes = new Uint8Array(await sourceResponse.arrayBuffer())
    }

    if (!contentType.toLowerCase().startsWith("image/")) {
      return new Response("Favicon source is not an image.", { status: 502 })
    }

    const dataUrl = `data:${contentType};base64,${bytesToBase64(bytes)}`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><clipPath id="rounded"><rect width="64" height="64" rx="13" ry="13"/></clipPath></defs>
  <image href="${dataUrl}" width="64" height="64" preserveAspectRatio="xMidYMid slice" clip-path="url(#rounded)"/>
</svg>`

    return new Response(request.method === "HEAD" ? null : svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
      },
    })
  }

  return {
    domainSettingsResponse,
    getDomainSettings,
    renderDomainFavicon,
    updateDomainSettings,
  }
}
