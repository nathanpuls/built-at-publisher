function iconParams({ domain, pageId, size, purpose = "any", version = "" }) {
  const params = new URLSearchParams({ domain, size: String(size), purpose })
  if (pageId) params.set("page", pageId)
  if (version) params.set("v", version)
  return params
}

function icoFromPng(png) {
  const header = new Uint8Array(22)
  const view = new DataView(header.buffer)
  view.setUint16(2, 1, true)
  view.setUint16(4, 1, true)
  header[6] = 32
  header[7] = 32
  header[10] = 1
  header[12] = 32
  view.setUint32(14, png.byteLength, true)
  view.setUint32(18, 22, true)
  const ico = new Uint8Array(22 + png.byteLength)
  ico.set(header)
  ico.set(png, 22)
  return ico
}

export function createIconHandlers({ calculatedPageTitle, getDomainSettings, json, normalizeDomain, pagePublicPath, requestDomain }) {
  async function sourceResponse(request, env, source) {
    if (source.startsWith("/api/media/file/")) {
      const key = decodeURIComponent(source.replace(/^\/api\/media\/file\//, ""))
      const object = await env.MEDIA_BUCKET?.get(key)
      if (!object) return null
      const headers = new Headers()
      object.writeHttpMetadata(headers)
      return new Response(object.body, { headers })
    }

    if (source === "/favicon-v2.svg") {
      return env.ASSETS.fetch(new Request(new URL(source, request.url), request))
    }

    return fetch(source)
  }

  async function iconContext(request, env) {
    const url = new URL(request.url)
    const domain = normalizeDomain(url.searchParams.get("domain") || requestDomain(request))
    const pageId = url.searchParams.get("page") || ""
    const page = pageId && env.DB
      ? await env.DB.prepare(
        `SELECT pages.*, users.username
         FROM pages
         LEFT JOIN users ON users.id = pages.owner_id
         WHERE pages.id = ? AND pages.deleted_at IS NULL`
      ).bind(pageId).first()
      : null
    const settings = await getDomainSettings(env, domain)

    return {
      domain,
      page,
      pageId: page?.id || "",
      source: page?.favicon_url || settings.faviconUrl || "/favicon-v2.svg",
      title: page ? calculatedPageTitle(page) : domain,
      version: page?.favicon_url
        ? page.updated_at || page.favicon_url
        : settings.updatedAt || "",
    }
  }

  async function renderIcon(request, env, { ico = false } = {}) {
    const context = await iconContext(request, env)
    const url = new URL(request.url)
    const size = Math.min(512, Math.max(16, Number(url.searchParams.get("size")) || 32))
    const isMaskable = url.searchParams.get("purpose") === "maskable"
    const source = await sourceResponse(request, env, context.source)
    if (!source?.ok || !source.body) return new Response("Icon source could not be loaded.", { status: 502 })
    let image = env.IMAGES?.input(source.body)
    if (image) {
      image = isMaskable
        ? image
          .transform({ fit: "contain", height: Math.round(size * 0.8), width: Math.round(size * 0.8) })
          .transform({ background: "#ffffff", fit: "pad", height: size, width: size })
        : image.transform({ fit: "cover", height: size, width: size })
    }
    const response = image ? (await image.output({ format: "image/png" })).response() : source
    const bytes = new Uint8Array(await response.arrayBuffer())
    const body = ico ? icoFromPng(bytes) : bytes

    return new Response(request.method === "HEAD" ? null : body, {
      headers: {
        "content-type": ico ? "image/x-icon" : "image/png",
        "cache-control": "public, max-age=86400",
      },
    })
  }

  async function renderManifest(request, env) {
    const context = await iconContext(request, env)
    const startUrl = context.page ? pagePublicPath(context.page) : "/"
    const icons = [192, 512].flatMap((size) => [
      {
        src: `/api/icon?${iconParams({ domain: context.domain, pageId: context.pageId, size, version: context.version })}`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/api/icon?${iconParams({ domain: context.domain, pageId: context.pageId, size, purpose: "maskable", version: context.version })}`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "maskable",
      },
    ])

    return json({
      name: context.title || context.domain,
      short_name: context.title || context.domain,
      start_url: startUrl || "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#ffffff",
      icons,
    }, {
      headers: { "cache-control": "public, max-age=300" },
    })
  }

  return { iconContext, renderIcon, renderManifest }
}
