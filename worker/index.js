import { marked } from "marked"
import { createDomainSettingsHandlers } from "./domain-settings"

const DEFAULT_MEDIA_PREFIX = ""
const DEFAULT_PUBLIC_MEDIA_BASE_URL = "https://media.nathanpuls.com"
const EMPTY_DOC_JSON = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
})
const PUBLIC_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const FAVICON_LINK = '<link rel="icon" type="image/svg+xml" href="/favicon-v2.svg">'
const EDITOR_ORIGIN = "https://built.at"
const DEFAULT_DOMAIN = "built.at"
const EDITABLE_DOMAINS = new Set(["built.at", "nathanpuls.com"])
const DEFAULT_FONT_STYLE = '<style data-built-default-font>html { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }</style>'
const MARKDOWN_LINK_STYLE = '<style data-built-markdown-links>a { color: #111827; text-decoration: underline; text-decoration-color: #6b7280; text-underline-offset: 0.25em; }</style>'

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
  })
}

function safeFilename(name) {
  const fallback = "image"
  const cleaned = (name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return cleaned || fallback
}

function extensionFromFilename(name) {
  const match = safeFilename(name).match(/\.([a-z0-9]+)$/)
  return match?.[1] ? `.${match[1]}` : ""
}

function makeId(length = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => PUBLIC_ID_ALPHABET[byte % PUBLIC_ID_ALPHABET.length]).join("")
}

function slugify(value) {
  const slug = (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "")

  return slug || "page"
}

function stripTags(value) {
  return (value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function faviconLink(faviconUrl = "") {
  return faviconUrl
    ? `<link rel="icon" type="image/svg+xml" sizes="any" href="${escapeHtml(faviconUrl)}">`
    : FAVICON_LINK
}

function withFavicon(html, faviconUrl = "") {
  let document = String(html || "")
  const link = faviconLink(faviconUrl)

  if (/<link\b[^>]*rel=["'][^"']*\b(?:icon|shortcut icon)\b[^"']*["'][^>]*>/i.test(document)) {
    document = document.replace(/<link\b[^>]*rel=["'][^"']*\b(?:icon|shortcut icon)\b[^"']*["'][^>]*>/i, link)
  } else if (/<\/head>/i.test(document)) {
    document = document.replace(/<\/head>/i, `  ${link}\n</head>`)
  }

  if (/<\/head>/i.test(document) && !/data-built-default-font/i.test(document)) {
    document = document.replace(/<\/head>/i, `  ${DEFAULT_FONT_STYLE}\n</head>`)
  }

  return document
}

function withPageMetadata(html, { title = "", faviconUrl = "" } = {}) {
  let document = withFavicon(html, faviconUrl)
  const titleTag = `<title>${escapeHtml(title || "Untitled")}</title>`

  if (/<title[^>]*>[\s\S]*?<\/title>/i.test(document)) {
    document = document.replace(/<title[^>]*>[\s\S]*?<\/title>/i, titleTag)
  } else if (/<\/head>/i.test(document)) {
    document = document.replace(/<\/head>/i, `  ${titleTag}\n</head>`)
  }

  return document
}

function withMarkdownLinkStyle(html) {
  const document = String(html || "")

  if (/data-built-markdown-links/i.test(document) || !/<\/head>/i.test(document)) {
    return document
  }

  return document.replace(/<\/head>/i, `  ${MARKDOWN_LINK_STYLE}\n</head>`)
}

function looksLikeHtml(value) {
  return /^\s*(?:<!doctype\s+html|<[a-z][a-z0-9-]*(?:\s|>|\/>))/i.test(value || "")
}

function redirectUrl(value) {
  const trimmed = String(value || "").trim()

  if (/^https?:\/\/[^\s<>"']+$/i.test(trimmed)) return trimmed

  if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?::\d+)?(?:\/[^\s<>"']*)?$/i.test(trimmed)) {
    return `https://${trimmed}`
  }

  return ""
}

function normalizeDomain(value) {
  const domain = String(value || DEFAULT_DOMAIN)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")

  return EDITABLE_DOMAINS.has(domain) ? domain : DEFAULT_DOMAIN
}

function requestDomain(request) {
  const hostname = new URL(request.url).hostname.toLowerCase().replace(/^www\./, "")
  return normalizeDomain(hostname)
}

const {
  domainSettingsResponse,
  getDomainSettings,
  renderDomainFavicon,
  updateDomainSettings,
} = createDomainSettingsHandlers({
  defaultDomain: DEFAULT_DOMAIN,
  json,
  normalizeDomain,
  requestDomain,
})

function iframeDocument(url, title = "Embedded page") {
  const iframeUrl = redirectUrl(url)

  if (!iframeUrl) return ""

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  ${FAVICON_LINK}
  <style>
    html, body, iframe { width: 100%; height: 100%; margin: 0; border: 0; }
    body { overflow: hidden; }
    iframe { display: block; }
  </style>
</head>
<body>
  <iframe src="${escapeHtml(iframeUrl)}" title="${escapeHtml(title)}" allow="autoplay; clipboard-read; clipboard-write; fullscreen" allowfullscreen></iframe>
</body>
</html>`
}

function titleFromHtml(html) {
  const explicitTitle = (html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]

  if (explicitTitle) {
    return stripTags(explicitTitle).slice(0, 160)
  }

  const heading = (html || "").match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]

  if (heading) {
    return stripTags(heading).slice(0, 160)
  }

  return ""
}

function titleFromMarkdown(markdown) {
  const heading = (markdown || "").match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim()

  if (heading) {
    return stripTags(heading).slice(0, 160)
  }

  return (markdown || "")
    .split("\n")
    .map((line) => stripTags(line.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "")))
    .find(Boolean)
    ?.slice(0, 160) || "Untitled page"
}

async function hashContent(content) {
  const bytes = new TextEncoder().encode(content)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function htmlDocument(html) {
  if (/<!doctype html|<html[\s>]/i.test(html)) {
    return withFavicon(html)
  }

  const title = titleFromHtml(html) || "Untitled HTML page"

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  ${FAVICON_LINK}
  ${DEFAULT_FONT_STYLE}
</head>
<body>
${html}
</body>
</html>`
}

function decodeCommonEntities(value) {
  return String(value || "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

function cleanStyleBlocks(html) {
  return String(html || "").replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attrs, css) => {
    const cleanedCss = decodeCommonEntities(css)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n")
      .replace(/<\/li\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/(^|\n)\s*{\s*\n?box-sizing/gi, "$1* {\nbox-sizing")
      .replace(/""/g, "\"")

    return `<style${attrs}>${cleanedCss}</style>`
  })
}

function cleanHtmlInput(html) {
  return cleanStyleBlocks(String(html || "").replace(/""/g, "\""))
}

function legacyMarkdownWrappedHtml(html) {
  const nestedDocument = String(html || "").match(/<body[^>]*>\s*(<!doctype html[\s\S]*)<\/body>\s*<\/html>\s*$/i)
  return nestedDocument?.[1] || html
}

function markdownDocument(markdown) {
  const title = titleFromMarkdown(markdown)
  const body = marked.parse(markdown, {
    async: false,
    gfm: true,
    breaks: true,
  })

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  ${FAVICON_LINK}
  ${MARKDOWN_LINK_STYLE}
  <style>
    body {
      color: #111827;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.65;
      max-width: 760px;
      margin: 64px auto;
      padding: 0 24px 80px;
    }
    img, video, iframe { max-width: 100%; }
    pre {
      overflow-x: auto;
      padding: 16px;
      border-radius: 8px;
      background: #f3f4f6;
    }
    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    }
    blockquote {
      margin-left: 0;
      padding-left: 18px;
      border-left: 3px solid #d1d5db;
      color: #4b5563;
    }
  </style>
</head>
<body>
${body}
</body>
</html>`
}

function notFoundPage({ pathname = "", message = "This page does not exist yet.", faviconUrl = "" } = {}) {
  const displayPath = pathname && pathname !== "/" ? pathname : "built.at"

  return new Response(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page not found</title>
  ${faviconLink(faviconUrl)}
  <style>
    :root {
      color-scheme: light;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --soft: #f6f7f8;
    }
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      color: var(--text);
      background:
        linear-gradient(180deg, #ffffff 0%, var(--soft) 100%);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: grid;
      place-items: center;
      padding: 32px 20px;
    }
    main {
      width: min(100%, 560px);
    }
    .eyebrow {
      margin: 0 0 18px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: clamp(34px, 7vw, 64px);
      line-height: 0.98;
      letter-spacing: 0;
    }
    p {
      max-width: 38rem;
      margin: 20px 0 0;
      color: #374151;
      font-size: 18px;
      line-height: 1.65;
    }
    .path {
      display: inline-block;
      max-width: 100%;
      margin-top: 22px;
      padding: 9px 11px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      color: var(--muted);
      font-size: 14px;
      overflow-wrap: anywhere;
    }
    a {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      margin-top: 28px;
      padding: 0 13px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      color: var(--text);
      text-decoration: none;
    }
    a:hover {
      border-color: #c7ccd1;
    }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">404</p>
    <h1>Nothing here yet.</h1>
    <p>${escapeHtml(message)}</p>
    <div class="path">${escapeHtml(displayPath)}</div>
    <br>
    <a href="/">Go home</a>
  </main>
</body>
</html>`, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  })
}

function redirectResponse(url) {
  return new Response(null, {
    status: 302,
    headers: {
      location: url,
      "cache-control": "no-store",
    },
  })
}

function subdomainPath(hostname) {
  if (!hostname.endsWith(".built.at")) return ""

  const subdomain = hostname.slice(0, -".built.at".length)

  if (!subdomain || subdomain === "www") return ""

  return subdomain
    .split(".")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/")
}

function contentToHtml(body) {
  const explicitHtml = typeof body.html === "string" ? body.html : null
  const explicitMarkdown = typeof body.markdown === "string" ? body.markdown : null
  const autoContent = (
    typeof body.text === "string" ? body.text :
    typeof body.content === "string" ? body.content :
    ""
  )
  const raw = (explicitHtml ?? explicitMarkdown ?? autoContent).replace(/\r\n?/g, "\n").trim()
  const requestedSourceType = String(body.sourceType || body.source_type || "").toLowerCase()

  if (!raw) {
    return { html: "", title: "", source: "", sourceType: requestedSourceType === "auto" ? "auto" : "empty" }
  }

  const redirect = redirectUrl(raw)

  if (requestedSourceType === "iframe" && redirect) {
    return {
      html: iframeDocument(redirect, body.title || titleFromRoutePath(body.path) || "Embedded page"),
      title: body.title || titleFromRoutePath(body.path) || redirect,
      source: redirect,
      sourceType: "iframe",
    }
  }

  if (requestedSourceType === "redirect" && redirect) {
    return {
      html: "",
      title: body.title || raw,
      source: redirect,
      sourceType: "redirect",
    }
  }

  if (requestedSourceType === "auto") {
    if (looksLikeHtml(raw)) {
      const html = cleanHtmlInput(raw)
      return { html: htmlDocument(html), title: titleFromHtml(html), source: raw, sourceType: "auto" }
    }

    return { html: markdownDocument(raw), title: titleFromMarkdown(raw), source: raw, sourceType: "auto" }
  }

  if (requestedSourceType === "markdown" || explicitMarkdown !== null) {
    return { html: markdownDocument(raw), title: titleFromMarkdown(raw), source: raw, sourceType: "markdown" }
  }

  if (requestedSourceType === "html" || explicitHtml !== null || looksLikeHtml(raw)) {
    const html = cleanHtmlInput(raw)
    return { html: htmlDocument(html), title: titleFromHtml(html), source: raw, sourceType: "html" }
  }

  if (redirect) {
    return {
      html: "",
      title: body.title || raw,
      source: redirect,
      sourceType: "redirect",
    }
  }

  return { html: markdownDocument(raw), title: titleFromMarkdown(raw), source: raw, sourceType: "markdown" }
}

function normalizeRoutePath(path) {
  const trimmed = String(path || "").trim()

  if (!trimmed) return ""

  const segments = trimmed
    .split("/")
    .map((segment) => segment
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase())
    .filter(Boolean)

  return segments.length ? `/${segments.join("/")}` : ""
}

function displayRoutePath(path) {
  return normalizeRoutePath(path).replace(/^\/+/, "")
}

function titleFromRoutePath(path) {
  const pathParts = displayRoutePath(path).split("/").filter(Boolean)

  return pathParts.at(-1) || ""
}

function reservedRoutePath(path) {
  const segment = displayRoutePath(path).split("/")[0]
  return ["admin", "api", "assets", "p"].includes(segment)
}

function isLocalRequest(request) {
  const { hostname } = new URL(request.url)
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}

function mediaUrl(request, env, key) {
  if (env.USE_PUBLIC_MEDIA_URLS === "true" && !isLocalRequest(request)) {
    const baseUrl = env.PUBLIC_MEDIA_BASE_URL || DEFAULT_PUBLIC_MEDIA_BASE_URL
    return `${baseUrl.replace(/\/$/, "")}/${key}`
  }

  return `/api/media/file/${key}`
}

function shortcutTokenError(request, env) {
  if (!env.SHORTCUT_API_TOKEN) {
    if (isLocalRequest(request)) {
      return null
    }

    return json(
      { error: "SHORTCUT_API_TOKEN is not configured." },
      { status: 500 }
    )
  }

  const authorization = request.headers.get("authorization") || ""
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  const headerToken = request.headers.get("x-simple-editor-token")
  const urlToken = new URL(request.url).searchParams.get("token")

  if (
    bearerToken === env.SHORTCUT_API_TOKEN ||
    headerToken === env.SHORTCUT_API_TOKEN ||
    urlToken === env.SHORTCUT_API_TOKEN
  ) {
    return null
  }

  return json({ error: "Unauthorized." }, { status: 401 })
}

async function uploadMedia(request, env) {
  if (!env.MEDIA_BUCKET) {
    return json({ error: "MEDIA_BUCKET binding is not configured." }, { status: 500 })
  }

  if (!env.DB) {
    return json({ error: "DB binding is not configured." }, { status: 500 })
  }

  const form = await request.formData()
  const file = form.get("file")

  if (!(file instanceof File)) {
    return json({ error: "Expected multipart form data with a file field." }, { status: 400 })
  }

  if (!file.type.startsWith("image/")) {
    return json({ error: "Only image uploads are allowed." }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const prefix = env.MEDIA_PREFIX ?? DEFAULT_MEDIA_PREFIX
  const originalName = file.name || "image"
  const extension = extensionFromFilename(originalName)
  const cleanedPrefix = prefix.replace(/^\/|\/$/g, "")
  const key = cleanedPrefix ? `${cleanedPrefix}/${id}${extension}` : `${id}${extension}`
  const now = new Date().toISOString()

  await env.MEDIA_BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
    },
    customMetadata: {
      originalName,
      uploadedAt: now,
    },
  })

  const url = mediaUrl(request, env, key)

  await env.DB.prepare(
    `INSERT INTO media_files
      (id, key, url, original_name, content_type, size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, key, url, originalName, file.type, file.size, now)
    .run()

  return json({
    id,
    key,
    url,
    originalName,
    contentType: file.type,
    size: file.size,
    createdAt: now,
  })
}

async function listMedia(env) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured." }, { status: 500 })
  }

  const result = await env.DB.prepare(
    `SELECT id, key, url, original_name AS originalName,
      content_type AS contentType, size, created_at AS createdAt
     FROM media_files
     ORDER BY created_at DESC
     LIMIT 100`
  ).all()

  return json({ files: result.results || [] })
}

async function getMediaObject(request, env) {
  if (!env.MEDIA_BUCKET) {
    return json({ error: "MEDIA_BUCKET binding is not configured." }, { status: 500 })
  }

  const { pathname } = new URL(request.url)
  const key = decodeURIComponent(pathname.replace(/^\/api\/media\/file\//, ""))
  const object = await env.MEDIA_BUCKET.get(key)

  if (!object) {
    return new Response("Not found", { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set("etag", object.httpEtag)

  return new Response(request.method === "HEAD" ? null : object.body, { headers })
}

function pageRowToResponse(row) {
  const path = row.path || ""
  const fallbackUrl = `/p/${row.id}${row.slug ? `/${row.slug}` : ""}`

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    hash: row.hash,
    html: row.markdown,
    markdown: row.markdown,
    source: row.source || row.markdown || "",
    sourceType: row.source_type || "html",
    domain: normalizeDomain(row.domain),
    path,
    isHome: Boolean(row.is_home),
    json: JSON.parse(row.json || EMPTY_DOC_JSON),
    status: row.status,
    url: path || fallbackUrl,
    fallbackUrl,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  }
}

async function savePageData(body, env, publish = false) {
  if (!env.DB) {
    throw new Response(JSON.stringify({ error: "DB binding is not configured." }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    })
  }

  const pageContent = contentToHtml(body)
  const html = pageContent.html
  const path = normalizeRoutePath(body.path || "")
  const domain = normalizeDomain(body.domain)
  const pathTitle = (pageContent.sourceType === "html" || (pageContent.sourceType === "auto" && looksLikeHtml(pageContent.source)))
    ? titleFromRoutePath(path)
    : ""
  const title = (
    typeof body.title === "string"
      ? body.title.trim()
      : pageContent.title || pathTitle || titleFromHtml(html) || "Untitled"
  ).slice(0, 160)
  const slug = slugify(body.slug || title)
  const isBlankPage = !html && !pageContent.source
  let hash = isBlankPage ? "" : await hashContent(html || pageContent.source)
  const docJson = JSON.stringify(body.json || JSON.parse(EMPTY_DOC_JSON))
  const status = publish ? "published" : body.status || "draft"
  const source = pageContent.source || ""
  const sourceType = pageContent.sourceType || "html"
  const now = new Date().toISOString()

  const requestedId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null
  let id = requestedId

  if (!id) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = makeId()
      const existing = await env.DB.prepare("SELECT id FROM pages WHERE id = ?").bind(candidate).first()

      if (!existing) {
        id = candidate
        break
      }
    }
  }

  if (!id) {
    return json({ error: "Could not generate a unique page id." }, { status: 500 })
  }

  if (isBlankPage) {
    hash = await hashContent(`empty:${id}`)
  } else {
    hash = `${id}:${hash}`
  }

  const existing = await env.DB.prepare("SELECT created_at FROM pages WHERE id = ?")
    .bind(id)
    .first()
  const createdAt = existing?.created_at || now
  const publishedAt = status === "published" ? now : null

  await env.DB.prepare(
    `INSERT INTO pages
      (id, slug, title, hash, markdown, json, status, created_at, updated_at, published_at, source, source_type, path, domain)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      hash = excluded.hash,
      markdown = excluded.markdown,
      json = excluded.json,
      status = excluded.status,
      source = excluded.source,
      source_type = excluded.source_type,
      path = excluded.path,
      domain = excluded.domain,
      updated_at = excluded.updated_at,
      published_at = COALESCE(excluded.published_at, pages.published_at)`
  )
    .bind(id, slug, title, hash, html, docJson, status, createdAt, now, publishedAt, source, sourceType, path, domain)
    .run()

  const row = await env.DB.prepare("SELECT * FROM pages WHERE id = ?").bind(id).first()
  return pageRowToResponse(row)
}

async function savePage(request, env, publish = false) {
  try {
    const body = await request.json()
    return json(await savePageData(body, env, publish))
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    throw error
  }
}

async function publishShortcutPage(request, env) {
  const tokenError = shortcutTokenError(request, env)

  if (tokenError) {
    return tokenError
  }

  const contentType = request.headers.get("content-type") || ""
  let body

  if (contentType.includes("application/json")) {
    body = await request.json()
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData()
    body = {
      html: form.get("html") || undefined,
      markdown: form.get("markdown") || undefined,
      text: form.get("text") || undefined,
      content: form.get("content") || undefined,
      title: form.get("title") || "",
      slug: form.get("slug") || "",
      path: form.get("path") || "",
      domain: form.get("domain") || DEFAULT_DOMAIN,
      sourceType: form.get("sourceType") || "",
    }
  } else {
    body = { content: await request.text() }
  }
  const rawContent = (
    typeof body.html === "string" ? body.html :
    typeof body.markdown === "string" ? body.markdown :
    typeof body.text === "string" ? body.text :
    typeof body.content === "string" ? body.content :
    ""
  ).replace(/\r\n?/g, "\n").trim()

  if (!rawContent) {
    return json({ error: "Expected HTML, Markdown, or text in html, markdown, text, content, a form field, or a plain text body." }, { status: 400 })
  }

  const page = await savePageData({
    title: body.title,
    slug: body.slug,
    path: body.path,
    domain: body.domain,
    sourceType: body.sourceType,
    html: body.html,
    markdown: body.markdown,
    text: body.text,
    content: body.content,
    allowDuplicate: true,
  }, env, true)
  const absoluteUrl = new URL(page.url, `https://${page.domain || DEFAULT_DOMAIN}`).href
  const editorUrl = new URL(
    `/admin?${new URLSearchParams({
      ...(page.domain && page.domain !== DEFAULT_DOMAIN ? { domain: page.domain } : {}),
      id: page.id,
    })}`,
    EDITOR_ORIGIN
  ).href

  return json({
    ...page,
    absoluteUrl,
    shareUrl: absoluteUrl,
    editorUrl,
  })
}

async function openShortcutPage(request, env) {
  const tokenError = shortcutTokenError(request, env)

  if (tokenError) {
    return tokenError
  }

  const url = new URL(request.url)
  const page = await savePageData({
    title: url.searchParams.get("title") || "",
    slug: url.searchParams.get("slug") || "",
    path: url.searchParams.get("path") || "",
    domain: url.searchParams.get("domain") || DEFAULT_DOMAIN,
    sourceType: url.searchParams.get("sourceType") || "",
    html: url.searchParams.get("html") || undefined,
    markdown: url.searchParams.get("markdown") || undefined,
    text: url.searchParams.get("text") || undefined,
    content: url.searchParams.get("content") || undefined,
    allowDuplicate: true,
  }, env)

  const params = new URLSearchParams({
    ...(page.domain && page.domain !== DEFAULT_DOMAIN ? { domain: page.domain } : {}),
    id: page.id,
  })

  return redirectResponse(new URL(`/admin?${params}`, EDITOR_ORIGIN).href)
}

async function getPage(id, env) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured." }, { status: 500 })
  }

  const row = await env.DB.prepare("SELECT * FROM pages WHERE id = ?").bind(id).first()

  if (!row) {
    return json({ error: "Page not found." }, { status: 404 })
  }

  return json(pageRowToResponse(row))
}

async function updatePage(request, env, id) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured." }, { status: 500 })
  }

  const existing = await env.DB.prepare("SELECT * FROM pages WHERE id = ?").bind(id).first()

  if (!existing) {
    return json({ error: "Page not found." }, { status: 404 })
  }

  const body = await request.json()
  const path = normalizeRoutePath(body.path ?? existing.path ?? "")
  const domain = normalizeDomain(body.domain ?? existing.domain)
  const source = (
    typeof body.source === "string" ? body.source :
    typeof body.html === "string" ? body.html :
    typeof body.markdown === "string" ? body.markdown :
    typeof body.content === "string" ? body.content :
    existing.source || existing.markdown || ""
  )
  const pageContent = contentToHtml({
    ...body,
    path,
    sourceType: body.sourceType ?? body.source_type ?? existing.source_type,
    content: source,
  })
  const html = pageContent.html
  const pathTitle = (pageContent.sourceType === "html" || (pageContent.sourceType === "auto" && looksLikeHtml(pageContent.source)))
    ? titleFromRoutePath(path)
    : ""
  const title = String(
    typeof body.title === "string"
      ? body.title.trim()
      : pageContent.title || pathTitle || existing.title || "Untitled"
  ).slice(0, 160)
  const slug = slugify(body.slug || title)
  const status = body.status || existing.status || "published"
  const now = new Date().toISOString()
  const hash = `${id}:${await hashContent(html || pageContent.source)}`

  if (path) {
    if (reservedRoutePath(path)) {
      return json({ error: `${displayRoutePath(path)} starts with a reserved path.` }, { status: 400 })
    }

    const pathConflict = await env.DB.prepare("SELECT id FROM pages WHERE domain = ? AND path = ? AND id <> ?")
      .bind(domain, path, id)
      .first()

    if (pathConflict) {
      return json({ error: `${displayRoutePath(path)} is already used.` }, { status: 409 })
    }
  }

  if (body.isHome) {
    await env.DB.prepare("UPDATE pages SET is_home = 0 WHERE domain = ? AND is_home = 1").bind(domain).run()
  }

  await env.DB.prepare(
    `UPDATE pages
     SET slug = ?, title = ?, hash = ?, markdown = ?, status = ?, updated_at = ?,
      source = ?, source_type = ?, path = ?, domain = ?, is_home = ?
     WHERE id = ?`
  )
    .bind(
      slug,
      title,
      hash,
      html,
      status,
      now,
      pageContent.source,
      pageContent.sourceType,
      path,
      domain,
      body.isHome ? 1 : (body.isHome === false ? 0 : existing.is_home || 0),
      id
    )
    .run()

  const row = await env.DB.prepare("SELECT * FROM pages WHERE id = ?").bind(id).first()
  return json(pageRowToResponse(row))
}

async function deletePage(env, id) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured." }, { status: 500 })
  }

  const existing = await env.DB.prepare("SELECT id FROM pages WHERE id = ?").bind(id).first()

  if (!existing) {
    return json({ error: "Page not found." }, { status: 404 })
  }

  await env.DB.prepare("DELETE FROM pages WHERE id = ?").bind(id).run()

  return json({ ok: true, id })
}

async function renderPage(id, env) {
  if (!env.DB) {
    return new Response("DB binding is not configured.", { status: 500 })
  }

  const row = await env.DB.prepare("SELECT * FROM pages WHERE id = ?").bind(id).first()

  if (!row) {
    return notFoundPage({
      pathname: `/p/${id}`,
      message: "That published page is not available anymore, or the link was copied incorrectly.",
    })
  }

  return renderPageRow(row, env)
}

async function renderPageRow(row, env) {
  if ((row.source_type || "").toLowerCase() === "redirect") {
    return redirectResponse(redirectUrl(row.source) || row.source)
  }

  const html = cleanHtmlInput(legacyMarkdownWrappedHtml(row.markdown || ""))
  const settings = await getDomainSettings(env, row.domain)
  const sourceType = (row.source_type || "").toLowerCase()
  const pageHtml = (sourceType === "markdown" || (sourceType === "auto" && !looksLikeHtml(row.source)))
    ? withMarkdownLinkStyle(html)
    : html

  return new Response(withPageMetadata(htmlDocument(pageHtml), {
    title: row.title,
    faviconUrl: settings.faviconHref,
  }), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  })
}

async function renderHome(env, domain = DEFAULT_DOMAIN) {
  if (!env.DB) {
    return new Response("DB binding is not configured.", { status: 500 })
  }

  const row = await env.DB.prepare(
    `SELECT * FROM pages
     WHERE domain = ? AND is_home = 1
     ORDER BY updated_at DESC
     LIMIT 1`
  ).bind(normalizeDomain(domain)).first()

  if (!row) {
    const settings = await getDomainSettings(env, domain)
    return notFoundPage({
      pathname: "/",
      message: "No home route has been selected yet.",
      faviconUrl: settings.faviconHref,
    })
  }

  return renderPageRow(row, env)
}

async function renderAdmin(request, env) {
  const requestUrl = new URL(request.url)
  const domain = normalizeDomain(requestUrl.searchParams.get("domain") || DEFAULT_DOMAIN)
  const settings = await getDomainSettings(env, domain)
  const assetUrl = new URL("/", request.url)
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request))
  const headers = new Headers(assetResponse.headers)

  headers.delete("content-length")
  headers.delete("content-encoding")
  headers.set("content-type", "text/html; charset=utf-8")
  headers.set("cache-control", "no-store")

  if (request.method === "HEAD") {
    return new Response(null, { status: assetResponse.status, headers })
  }

  const html = withPageMetadata(await assetResponse.text(), {
    title: `Admin | ${domain}`,
    faviconUrl: settings.faviconHref,
  })

  return new Response(html, { status: assetResponse.status, headers })
}

async function renderRoutePath(pathname, env, domain = DEFAULT_DOMAIN) {
  if (!env.DB) {
    return new Response("DB binding is not configured.", { status: 500 })
  }

  const path = normalizeRoutePath(pathname)
  const row = await env.DB.prepare("SELECT * FROM pages WHERE domain = ? AND path = ?")
    .bind(normalizeDomain(domain), path)
    .first()

  if (!row) {
    return null
  }

  return renderPageRow(row, env)
}

async function listPages(env, domain = DEFAULT_DOMAIN) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured." }, { status: 500 })
  }

  const result = await env.DB.prepare(
    `SELECT id, slug, title, status, markdown, source, source_type, path, domain, is_home,
      created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
     FROM pages
     WHERE domain = ?
     ORDER BY updated_at DESC
     LIMIT 100`
  ).bind(normalizeDomain(domain)).all()

  return json({
    pages: (result.results || []).map(({ markdown, ...page }) => ({
      ...page,
      source: page.source || legacyMarkdownWrappedHtml(markdown || ""),
      sourceType: page.source_type || "html",
      domain: normalizeDomain(page.domain),
      path: page.path || "",
      isHome: Boolean(page.is_home),
      url: page.path || `/p/${page.id}${page.slug ? `/${page.slug}` : ""}`,
      fallbackUrl: `/p/${page.id}${page.slug ? `/${page.slug}` : ""}`,
    })),
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.hostname === "admin.built.at") {
      return redirectResponse(`https://built.at/admin${url.search}`)
    }

    const mappedSubdomainPath = subdomainPath(url.hostname)

    if (mappedSubdomainPath) {
      const restPath = url.pathname === "/" ? "" : url.pathname
      return redirectResponse(`https://built.at/${mappedSubdomainPath}${restPath}${url.search}`)
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 })
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true })
    }

    if (url.pathname.startsWith("/admin") && (request.method === "GET" || request.method === "HEAD")) {
      return renderAdmin(request, env)
    }

    if (url.pathname === "/api/domain-settings" && request.method === "GET") {
      return domainSettingsResponse(env, url.searchParams.get("domain") || DEFAULT_DOMAIN)
    }

    if (url.pathname === "/api/domain-settings" && request.method === "PATCH") {
      return updateDomainSettings(request, env)
    }

    if (
      ["/api/domain-favicon", "/api/domain-favicon-v2"].includes(url.pathname) &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      return renderDomainFavicon(request, env)
    }

    if (url.pathname === "/api/pages" && request.method === "POST") {
      return savePage(request, env)
    }

    if (url.pathname === "/api/pages" && request.method === "GET") {
      return listPages(env, url.searchParams.get("domain") || DEFAULT_DOMAIN)
    }

    const pageMatch = url.pathname.match(/^\/api\/pages\/([A-Za-z0-9_-]+)$/)

    if (pageMatch && request.method === "GET") {
      return getPage(pageMatch[1], env)
    }

    if (pageMatch && request.method === "PATCH") {
      return updatePage(request, env, pageMatch[1])
    }

    if (pageMatch && request.method === "DELETE") {
      return deletePage(env, pageMatch[1])
    }

    if (url.pathname === "/api/publish" && request.method === "POST") {
      return savePage(request, env, true)
    }

    if (url.pathname === "/api/shortcut" && request.method === "GET") {
      return openShortcutPage(request, env)
    }

    if (url.pathname === "/api/shortcut" && request.method === "POST") {
      return publishShortcutPage(request, env)
    }

    const docMatch = url.pathname.match(/^\/api\/doc\/([A-Za-z0-9_-]+)$/)

    if (docMatch && request.method === "GET") {
      return getPage(docMatch[1], env)
    }

    const publicPageMatch = url.pathname.match(/^\/p\/([A-Za-z0-9_-]+)(?:\/.*)?$/)

    if (publicPageMatch && (request.method === "GET" || request.method === "HEAD")) {
      return renderPage(publicPageMatch[1], env)
    }

    if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
      return renderHome(env, requestDomain(request))
    }

    if (url.pathname === "/api/media" && request.method === "POST") {
      return uploadMedia(request, env)
    }

    if (url.pathname === "/api/media" && request.method === "GET") {
      return listMedia(env)
    }

    if (
      url.pathname.startsWith("/api/media/file/") &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      return getMediaObject(request, env)
    }

    if (
      (request.method === "GET" || request.method === "HEAD") &&
      !url.pathname.startsWith("/admin") &&
      !url.pathname.startsWith("/assets/") &&
      !url.pathname.includes(".")
    ) {
      const routeResponse = await renderRoutePath(url.pathname, env, requestDomain(request))

      if (routeResponse) {
        return routeResponse
      }

      return notFoundPage({
        pathname: url.pathname,
        message: "There is not a published route at this path yet.",
        faviconUrl: (await getDomainSettings(env, requestDomain(request))).faviconHref,
      })
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    return new Response("Not found", { status: 404 })
  },
}
