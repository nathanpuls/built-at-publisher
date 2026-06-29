import { marked } from "marked"
import { createAuthHandlers } from "./auth"
import { createDomainSettingsHandlers } from "./domain-settings"
import { createIconHandlers } from "./icons"
import { createMediaHandlers } from "./media"

const EMPTY_DOC_JSON = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
})
const PUBLIC_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const FAVICON_LINK = '<link rel="icon" type="image/svg+xml" href="/favicon-v2.svg">'
const EDITOR_ORIGIN = "https://built.at"
const DEFAULT_DOMAIN = "built.at"
const PLATFORM_OWNER_ID = "built-at-owner"
const SIGN_IN_PAGE_ID = "builtSignup"
const CHOOSE_USERNAME_PAGE_ID = "builtChooseUsername"
const EDITABLE_DOMAINS = new Set(["built.at", "nathanpuls.com", "fullpsych.com", "ends.at"])
const DOMAIN_FALLBACK_ORIGINS = new Map([
  ["ends.at", "https://ends-notes.pages.dev"],
])
const BUILT_PUBLIC_API_PATHS = new Set([
  "/api/domain-favicon",
  "/api/domain-favicon-v2",
  "/api/icon",
  "/api/icon.ico",
  "/api/manifest",
])
const RESERVED_USERNAMES = new Set(["admin", "api", "assets", "p", "signup"])
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

function iconLinks({ domain = DEFAULT_DOMAIN, pageId = "", version = "" } = {}) {
  const scope = [
    `domain=${encodeURIComponent(domain)}`,
    pageId ? `page=${encodeURIComponent(pageId)}` : "",
    version ? `v=${encodeURIComponent(version)}` : "",
  ].filter(Boolean).join("&")
  return [
    `<link rel="icon" type="image/png" sizes="16x16" href="/api/icon?${scope}&size=16">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="/api/icon?${scope}&size=32">`,
    `<link rel="shortcut icon" href="/api/icon.ico?${scope}">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="/api/icon?${scope}&size=180">`,
    `<link rel="manifest" href="/api/manifest?${scope}">`,
  ].join("\n  ")
}

function faviconLink() {
  return iconLinks()
}

function withFavicon(html, iconContext = {}) {
  let document = String(html || "")
  const link = iconLinks(iconContext)

  if (/<link\b[^>]*rel=["'][^"']*\b(?:icon|shortcut icon|apple-touch-icon|manifest)\b[^"']*["'][^>]*>/i.test(document)) {
    document = document.replace(/(?:\s*<link\b[^>]*rel=["'][^"']*\b(?:icon|shortcut icon|apple-touch-icon|manifest)\b[^"']*["'][^>]*>)+/gi, `\n  ${link}`)
  } else if (/<\/head>/i.test(document)) {
    document = document.replace(/<\/head>/i, `  ${link}\n</head>`)
  }

  if (/<\/head>/i.test(document) && !/data-built-default-font/i.test(document)) {
    document = document.replace(/<\/head>/i, `  ${DEFAULT_FONT_STYLE}\n</head>`)
  }

  return document
}

function withPageMetadata(html, { title = "", domain = DEFAULT_DOMAIN, pageId = "", iconVersion = "" } = {}) {
  let document = withFavicon(html, { domain, pageId, version: iconVersion })
  const titleTag = `<title>${escapeHtml(title)}</title>`

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

function normalizeUsername(value) {
  const username = String(value || "").trim().toLowerCase()
  if (!/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/.test(username)) return ""
  return RESERVED_USERNAMES.has(username) ? "" : username
}

function pagePublicPath(row) {
  const domain = normalizeDomain(row.domain)
  const path = row.path || ""

  if (row.id === SIGN_IN_PAGE_ID) return "/signup"
  if (row.id === CHOOSE_USERNAME_PAGE_ID) return "/signup?choose=username"

  if (domain !== DEFAULT_DOMAIN) {
    return path || `/p/${row.id}${row.slug ? `/${row.slug}` : ""}`
  }

  if (row.namespace === "user" && row.username) {
    return `/${row.username}${path && path !== "/" ? path : ""}`
  }

  return path ? `/p${path}` : `/p/${row.id}${row.slug ? `/${row.slug}` : ""}`
}

function requestDomain(request) {
  const hostname = new URL(request.url).hostname.toLowerCase().replace(/^www\./, "")
  return normalizeDomain(hostname)
}

function domainFallbackOrigin(domain) {
  return DOMAIN_FALLBACK_ORIGINS.get(normalizeDomain(domain)) || ""
}

const {
  authStatus,
  beginGoogleAuth,
  chooseUsername,
  currentUser,
  finishGoogleAuth,
  logout,
  usernameAvailability,
} = createAuthHandlers({
  editorOrigin: EDITOR_ORIGIN,
  json,
  makeId,
})

function isRegularUser(user) {
  return Boolean(user && user.role !== "owner")
}

function canAccessPage(user, page) {
  return !isRegularUser(user) || (
    page.owner_id === user.id &&
    page.namespace === "user" &&
    normalizeDomain(page.domain) === DEFAULT_DOMAIN
  )
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

const { renderIcon, renderManifest } = createIconHandlers({
  calculatedPageTitle,
  getDomainSettings,
  json,
  normalizeDomain,
  pagePublicPath,
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

  const heading = (html || "").match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]

  if (heading) {
    return stripTags(heading).slice(0, 160)
  }

  return stripTags((html || "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, " ")
    .replace(/<(script|style|template)[^>]*>[\s\S]*?<\/\1>/gi, " "))
    .slice(0, 160)
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
    ?.slice(0, 160) || ""
}

function calculatedPageTitle(row) {
  const source = row.source || ""
  const sourceType = (row.source_type || "").toLowerCase()
  const sourceTitle = (sourceType === "html" || (sourceType === "auto" && looksLikeHtml(source)))
    ? titleFromHtml(source)
    : titleFromMarkdown(source)

  const explicitTitle = String(row.title || "").trim()

  return explicitTitle || sourceTitle || titleFromRoutePath(row.path) || ""
}

function suggestedPageTitle(pageContent, path) {
  const source = pageContent.source || ""
  const sourceType = (pageContent.sourceType || "").toLowerCase()
  const sourceTitle = (sourceType === "html" || (sourceType === "auto" && looksLikeHtml(source)))
    ? titleFromHtml(source)
    : (sourceType === "markdown" || sourceType === "auto")
      ? titleFromMarkdown(source)
      : ""

  return sourceTitle || titleFromRoutePath(path) || ""
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
      "cache-control": "public, max-age=5, must-revalidate",
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

function httpsUpgradeResponse(request, url) {
  const forwardedProto = request.headers.get("x-forwarded-proto")
  if (url.protocol !== "http:" && forwardedProto !== "http") return null

  const secureUrl = new URL(url.href)
  secureUrl.protocol = "https:"

  return new Response(null, {
    status: 301,
    headers: {
      location: secureUrl.href,
      "cache-control": "no-store",
    },
  })
}

function mappedSubdomainRedirect(hostname, pathname = "/", search = "") {
  const normalizedHostname = hostname.toLowerCase()

  for (const domain of EDITABLE_DOMAINS) {
    if (!normalizedHostname.endsWith(`.${domain}`)) continue

    const subdomain = normalizedHostname.slice(0, -(domain.length + 1))
    if (!subdomain || subdomain === "www") return ""

    const mappedPath = subdomain
      .split(".")
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join("/")

    if (!mappedPath) return ""

    const restPath = pathname === "/" ? "" : pathname
    return `https://${domain}/${mappedPath}${restPath}${search}`
  }

  return ""
}

async function proxyDomainFallback(request, domain) {
  const origin = domainFallbackOrigin(domain)
  if (!origin) return null

  const requestUrl = new URL(request.url)
  const fallbackUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, origin)
  const headers = new Headers(request.headers)

  headers.delete("host")
  headers.set("x-built-at-fallback-domain", normalizeDomain(domain))

  const fallbackRequest = new Request(fallbackUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? null : request.body,
    redirect: request.redirect,
  })

  return fetch(fallbackRequest)
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
  return rawTitleFromRoutePath(path).replace(/-+/g, " ").trim()
}

function rawTitleFromRoutePath(path) {
  const pathParts = displayRoutePath(path).split("/").filter(Boolean)
  return pathParts.at(-1) || ""
}

function storedTitleMode(row) {
  if (row.title_mode === "auto" || row.title_mode === "manual") return row.title_mode

  const title = String(row.title || "").trim()
  return !row.source?.trim() && title && title === rawTitleFromRoutePath(row.path) ? "auto" : "manual"
}

function reservedRoutePath(path) {
  const segment = displayRoutePath(path).split("/")[0]
  return ["admin", "api", "assets", "p"].includes(segment)
}

function isLocalRequest(request) {
  const { hostname } = new URL(request.url)
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}

const {
  getMediaObject,
  listMedia,
  uploadMedia,
} = createMediaHandlers({ isLocalRequest, json })

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

function pageRowToResponse(row) {
  const path = row.path || ""
  const fallbackUrl = `/p/${row.id}${row.slug ? `/${row.slug}` : ""}`

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    titleMode: storedTitleMode(row),
    faviconUrl: row.favicon_url || "",
    hash: row.hash,
    html: row.markdown,
    markdown: row.markdown,
    source: row.source || row.markdown || "",
    sourceType: row.source_type || "html",
    domain: normalizeDomain(row.domain),
    path,
    ownerId: row.owner_id || PLATFORM_OWNER_ID,
    namespace: row.namespace || "platform",
    username: row.username || "",
    isHome: Boolean(row.is_home),
    json: JSON.parse(row.json || EMPTY_DOC_JSON),
    status: row.status,
    url: pagePublicPath(row),
    fallbackUrl,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    deletedAt: row.deleted_at,
  }
}

async function pageById(env, id, { deleted = false } = {}) {
  return env.DB.prepare(
    `SELECT pages.*, users.username
     FROM pages
     LEFT JOIN users ON users.id = pages.owner_id
     WHERE pages.id = ? AND pages.deleted_at IS ${deleted ? "NOT NULL" : "NULL"}`
  ).bind(id).first()
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
  const ownerId = String(body.ownerId || PLATFORM_OWNER_ID).trim() || PLATFORM_OWNER_ID
  const namespace = body.namespace === "user" ? "user" : "platform"
  const requestedFaviconUrl = typeof body.faviconUrl === "string" ? body.faviconUrl.trim() : null
  const requestedTitle = (
    typeof body.title === "string"
      ? body.title.trim()
      : ""
  ).slice(0, 160)
  const titleMode = body.titleMode === "manual" && requestedTitle ? "manual" : "auto"
  const title = requestedTitle || suggestedPageTitle(pageContent, path)
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

  const existing = await env.DB.prepare("SELECT created_at, favicon_url, owner_id, namespace FROM pages WHERE id = ?")
    .bind(id)
    .first()
  const faviconUrl = requestedFaviconUrl ?? existing?.favicon_url ?? ""
  const storedOwnerId = existing?.owner_id || ownerId
  const storedNamespace = existing?.namespace || namespace
  const createdAt = existing?.created_at || now
  const publishedAt = status === "published" ? now : null

  await env.DB.prepare(
    `INSERT INTO pages
      (id, slug, title, hash, markdown, json, status, created_at, updated_at, published_at, source, source_type, path, domain, favicon_url, title_mode, owner_id, namespace)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      favicon_url = excluded.favicon_url,
      title_mode = excluded.title_mode,
      owner_id = excluded.owner_id,
      namespace = excluded.namespace,
      updated_at = excluded.updated_at,
      published_at = COALESCE(excluded.published_at, pages.published_at)`
  )
    .bind(id, slug, title, hash, html, docJson, status, createdAt, now, publishedAt, source, sourceType, path, domain, faviconUrl, titleMode, storedOwnerId, storedNamespace)
    .run()

  const row = await pageById(env, id)
  return pageRowToResponse(row)
}

async function savePage(request, env, publish = false, user = null) {
  try {
    const body = await request.json()
    const personalWorkspace = Boolean(user && body.namespace === "user")

    if ((isRegularUser(user) || personalWorkspace) && !user.username) {
      return json({ error: "Choose a username before creating pages." }, { status: 403 })
    }

    if (isRegularUser(user) && body.id) {
      const existing = await env.DB.prepare(
        "SELECT owner_id, namespace, domain FROM pages WHERE id = ? LIMIT 1"
      ).bind(String(body.id)).first()

      if (existing && !canAccessPage(user, existing)) {
        return json({ error: "Page not found." }, { status: 404 })
      }
    }

    const scopedBody = isRegularUser(user) || personalWorkspace
      ? {
          ...body,
          domain: DEFAULT_DOMAIN,
          ownerId: user.id,
          namespace: "user",
        }
      : body
    return json(await savePageData(scopedBody, env, publish))
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

async function getPage(id, env, user = null) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured." }, { status: 500 })
  }

  const row = await pageById(env, id)

  if (!row) {
    return json({ error: "Page not found." }, { status: 404 })
  }

  if (!canAccessPage(user, row)) {
    return json({ error: "Page not found." }, { status: 404 })
  }

  return json(pageRowToResponse(row))
}

async function getManagedSignupPage(env) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured." }, { status: 500 })
  }

  const [signInRow, chooseUsernameRow] = await Promise.all([
    pageById(env, SIGN_IN_PAGE_ID),
    pageById(env, CHOOSE_USERNAME_PAGE_ID),
  ])

  return json({
    signInPage: signInRow ? pageRowToResponse(signInRow) : null,
    chooseUsernamePage: chooseUsernameRow ? pageRowToResponse(chooseUsernameRow) : null,
  })
}

async function updatePage(request, env, id, user = null) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured." }, { status: 500 })
  }

  const existing = await env.DB.prepare("SELECT * FROM pages WHERE id = ? AND deleted_at IS NULL").bind(id).first()

  if (!existing) {
    return json({ error: "Page not found." }, { status: 404 })
  }

  if (!canAccessPage(user, existing)) {
    return json({ error: "Page not found." }, { status: 404 })
  }

  const body = await request.json()
  const isSystemPage = existing.namespace === "system"
  const path = isSystemPage
    ? existing.path
    : normalizeRoutePath(body.path ?? existing.path ?? "")
  const domain = isSystemPage
    ? normalizeDomain(existing.domain)
    : normalizeDomain(body.domain ?? existing.domain)
  const ownerId = existing.owner_id || PLATFORM_OWNER_ID
  const namespace = existing.namespace || "platform"
  const faviconUrl = typeof body.faviconUrl === "string" ? body.faviconUrl.trim() : existing.favicon_url || ""
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
  const requestedTitle = String(
    typeof body.title === "string"
      ? body.title.trim()
      : existing.title || ""
  ).slice(0, 160)
  const existingTitleMode = storedTitleMode(existing)
  const titleMode = body.titleMode === "manual" && requestedTitle
    ? "manual"
    : body.titleMode === "auto" || !requestedTitle
      ? "auto"
      : existingTitleMode
  const title = requestedTitle || suggestedPageTitle(pageContent, path)
  const slug = slugify(body.slug || title)
  const status = body.status || existing.status || "published"
  const now = new Date().toISOString()
  const hash = `${id}:${await hashContent(html || pageContent.source)}`

  if (path) {
    if (reservedRoutePath(path)) {
      return json({ error: `${displayRoutePath(path)} starts with a reserved path.` }, { status: 400 })
    }

    const pathConflict = await env.DB.prepare(
      "SELECT id FROM pages WHERE domain = ? AND namespace = ? AND owner_id = ? AND path = ? AND id <> ? AND deleted_at IS NULL"
    )
      .bind(domain, namespace, ownerId, path, id)
      .first()

    if (pathConflict) {
      return json({ error: `${displayRoutePath(path)} is already used.` }, { status: 409 })
    }
  }

  if (body.isHome) {
    await env.DB.prepare(
      `UPDATE pages SET is_home = 0
       WHERE domain = ? AND namespace = ? AND owner_id = ?
         AND is_home = 1 AND deleted_at IS NULL`
    ).bind(domain, namespace, ownerId).run()
  }

  await env.DB.prepare(
    `UPDATE pages
     SET slug = ?, title = ?, hash = ?, markdown = ?, status = ?, updated_at = ?,
      source = ?, source_type = ?, path = ?, domain = ?, is_home = ?, favicon_url = ?, title_mode = ?
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
      faviconUrl,
      titleMode,
      id
    )
    .run()

  const row = await pageById(env, id)
  return json(pageRowToResponse(row))
}

async function deletePage(env, id, user = null) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured." }, { status: 500 })
  }

  const existing = await env.DB.prepare(
    "SELECT id, owner_id, namespace, domain FROM pages WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first()

  if (!existing) {
    return json({ error: "Page not found." }, { status: 404 })
  }

  if (!canAccessPage(user, existing)) {
    return json({ error: "Page not found." }, { status: 404 })
  }

  if (existing.namespace === "system") {
    return json({ error: "System pages cannot be deleted." }, { status: 403 })
  }

  const deletedAt = new Date().toISOString()
  await env.DB.prepare("UPDATE pages SET deleted_at = ? WHERE id = ?").bind(deletedAt, id).run()

  return json({ ok: true, id, deletedAt })
}

async function listTrash(env, domain = DEFAULT_DOMAIN, user = null, personalWorkspace = false) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured." }, { status: 500 })
  }

  await purgeExpiredTrash(env)

  const result = isRegularUser(user) || (user && personalWorkspace)
    ? await env.DB.prepare(
        `SELECT pages.*, users.username
         FROM pages
         LEFT JOIN users ON users.id = pages.owner_id
         WHERE pages.domain = ? AND pages.namespace = 'user'
           AND pages.owner_id = ? AND pages.deleted_at IS NOT NULL
         ORDER BY pages.deleted_at DESC
         LIMIT 100`
      ).bind(DEFAULT_DOMAIN, user.id).all()
    : await env.DB.prepare(
        `SELECT pages.*, users.username
         FROM pages
         LEFT JOIN users ON users.id = pages.owner_id
         WHERE pages.domain = ? AND pages.deleted_at IS NOT NULL
         ORDER BY pages.deleted_at DESC
         LIMIT 100`
      ).bind(normalizeDomain(domain)).all()

  return json({ pages: (result.results || []).map(pageRowToResponse) })
}

async function restorePage(env, id, user = null) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured." }, { status: 500 })
  }

  const page = await pageById(env, id, { deleted: true })

  if (!page) {
    return json({ error: "Deleted page not found." }, { status: 404 })
  }

  if (!canAccessPage(user, page)) {
    return json({ error: "Deleted page not found." }, { status: 404 })
  }

  if (page.path) {
    const conflict = await env.DB.prepare(
      `SELECT id FROM pages
       WHERE domain = ? AND namespace = ? AND owner_id = ?
         AND path = ? AND deleted_at IS NULL`
    ).bind(
      normalizeDomain(page.domain),
      page.namespace || "platform",
      page.owner_id || PLATFORM_OWNER_ID,
      page.path
    ).first()

    if (conflict) {
      return json({ error: `${displayRoutePath(page.path)} is already used. Remove or rename that path before restoring.` }, { status: 409 })
    }
  }

  const now = new Date().toISOString()

  if (page.is_home) {
    await env.DB.prepare(
      `UPDATE pages SET is_home = 0
       WHERE domain = ? AND namespace = ? AND owner_id = ?
         AND is_home = 1 AND deleted_at IS NULL`
    ).bind(
      normalizeDomain(page.domain),
      page.namespace || "platform",
      page.owner_id || PLATFORM_OWNER_ID
    ).run()
  }

  await env.DB.prepare("UPDATE pages SET deleted_at = NULL, updated_at = ? WHERE id = ?").bind(now, id).run()
  const restored = await pageById(env, id)

  return json(pageRowToResponse(restored))
}

async function permanentlyDeletePage(env, id, user = null) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured." }, { status: 500 })
  }

  const page = await env.DB.prepare(
    "SELECT id, owner_id, namespace, domain FROM pages WHERE id = ? AND deleted_at IS NOT NULL"
  ).bind(id).first()

  if (!page) {
    return json({ error: "Deleted page not found." }, { status: 404 })
  }

  if (!canAccessPage(user, page)) {
    return json({ error: "Deleted page not found." }, { status: 404 })
  }

  await env.DB.prepare("DELETE FROM pages WHERE id = ? AND deleted_at IS NOT NULL").bind(id).run()
  return json({ ok: true, id })
}

async function purgeExpiredTrash(env) {
  if (!env.DB) return

  await env.DB.prepare(
    "DELETE FROM pages WHERE deleted_at IS NOT NULL AND datetime(deleted_at) <= datetime('now', '-30 days')"
  ).run()
}

async function renderPage(id, env) {
  if (!env.DB) {
    return new Response("DB binding is not configured.", { status: 500 })
  }

  const row = await env.DB.prepare(
    `SELECT pages.*, users.username
     FROM pages
     LEFT JOIN users ON users.id = pages.owner_id
     WHERE pages.id = ? AND pages.deleted_at IS NULL`
  ).bind(id).first()

  if (!row) {
    return notFoundPage({
      pathname: `/p/${id}`,
      message: "That published page is not available anymore, or the link was copied incorrectly.",
    })
  }

  return renderPageRow(row, env)
}

async function renderPlatformPath(pathname, env) {
  const path = normalizeRoutePath(pathname)
  const row = await env.DB.prepare(
    `SELECT pages.*, users.username
     FROM pages
     LEFT JOIN users ON users.id = pages.owner_id
     WHERE pages.domain = ? AND pages.namespace = 'platform'
       AND pages.path = ? AND pages.deleted_at IS NULL
     LIMIT 1`
  ).bind(DEFAULT_DOMAIN, path).first()

  return row ? renderPageRow(row, env) : null
}

async function renderUserPath(usernameValue, pathname, env) {
  const username = normalizeUsername(usernameValue)
  if (!username) return null

  const user = await env.DB.prepare(
    "SELECT id, username FROM users WHERE username = ? LIMIT 1"
  ).bind(username).first()
  if (!user) return null

  const path = normalizeRoutePath(pathname)
  const row = path
    ? await env.DB.prepare(
      `SELECT pages.*, users.username
       FROM pages
       JOIN users ON users.id = pages.owner_id
       WHERE pages.domain = ? AND pages.namespace = 'user'
         AND pages.owner_id = ? AND pages.path = ? AND pages.deleted_at IS NULL
       LIMIT 1`
    ).bind(DEFAULT_DOMAIN, user.id, path).first()
    : await env.DB.prepare(
      `SELECT pages.*, users.username
       FROM pages
       JOIN users ON users.id = pages.owner_id
       WHERE pages.domain = ? AND pages.namespace = 'user'
         AND pages.owner_id = ? AND pages.is_home = 1 AND pages.deleted_at IS NULL
       ORDER BY pages.updated_at DESC
       LIMIT 1`
    ).bind(DEFAULT_DOMAIN, user.id).first()

  return row ? renderPageRow(row, env) : null
}

async function renderPageRow(row, env) {
  if ((row.source_type || "").toLowerCase() === "redirect") {
    return redirectResponse(redirectUrl(row.source) || row.source)
  }

  const html = cleanHtmlInput(legacyMarkdownWrappedHtml(row.markdown || ""))
  const sourceType = (row.source_type || "").toLowerCase()
  const pageHtml = (sourceType === "markdown" || (sourceType === "auto" && !looksLikeHtml(row.source)))
    ? withMarkdownLinkStyle(html)
    : html

  const domain = normalizeDomain(row.domain)
  const iconVersion = row.favicon_url
    ? row.updated_at || row.favicon_url
    : (await getDomainSettings(env, domain)).updatedAt || ""

  return new Response(withPageMetadata(htmlDocument(pageHtml), {
    title: calculatedPageTitle(row),
    domain,
    pageId: row.id,
    iconVersion,
  }), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=5, must-revalidate",
    },
  })
}

async function renderHome(env, domain = DEFAULT_DOMAIN) {
  if (!env.DB) {
    return new Response("DB binding is not configured.", { status: 500 })
  }

  const row = await env.DB.prepare(
    `SELECT * FROM pages
     WHERE domain = ? AND is_home = 1 AND deleted_at IS NULL
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

async function renderDomainPathRequest(request, env) {
  if (!env.DB) {
    return new Response("DB binding is not configured.", { status: 500 })
  }

  const url = new URL(request.url)
  const domain = normalizeDomain(url.searchParams.get("domain") || DEFAULT_DOMAIN)
  const path = normalizeRoutePath(url.searchParams.get("path") || "/")
  const row = path
    ? await env.DB.prepare(
      `SELECT pages.*, users.username
       FROM pages
       LEFT JOIN users ON users.id = pages.owner_id
       WHERE pages.domain = ? AND pages.namespace = 'platform'
         AND pages.path = ? AND pages.deleted_at IS NULL
       LIMIT 1`
    ).bind(domain, path).first()
    : await env.DB.prepare(
      `SELECT pages.*, users.username
       FROM pages
       LEFT JOIN users ON users.id = pages.owner_id
       WHERE pages.domain = ? AND pages.namespace = 'platform'
         AND pages.is_home = 1 AND pages.deleted_at IS NULL
       ORDER BY pages.updated_at DESC
       LIMIT 1`
    ).bind(domain).first()

  if (!row) {
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
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

async function renderSignup(request, env) {
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

  const html = withPageMetadata(await assetResponse.text(), { title: "Sign up | built.at" })
  return new Response(html, { status: assetResponse.status, headers })
}

async function renderRoutePath(pathname, env, domain = DEFAULT_DOMAIN) {
  if (!env.DB) {
    return new Response("DB binding is not configured.", { status: 500 })
  }

  const path = normalizeRoutePath(pathname)
  const row = await env.DB.prepare(
    `SELECT pages.*, users.username
     FROM pages
     LEFT JOIN users ON users.id = pages.owner_id
     WHERE pages.domain = ? AND pages.namespace = 'platform'
       AND pages.path = ? AND pages.deleted_at IS NULL`
  )
    .bind(normalizeDomain(domain), path)
    .first()

  if (!row) {
    return null
  }

  return renderPageRow(row, env)
}

async function listPages(env, domain = DEFAULT_DOMAIN, user = null, personalWorkspace = false) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured." }, { status: 500 })
  }

  const fields = `SELECT pages.id, pages.slug, pages.title, pages.title_mode, pages.status, pages.markdown,
      pages.source, pages.source_type, pages.path, pages.domain, pages.is_home, pages.favicon_url,
      pages.owner_id, pages.namespace, users.username,
      pages.created_at AS createdAt, pages.updated_at AS updatedAt, pages.published_at AS publishedAt
     FROM pages
     LEFT JOIN users ON users.id = pages.owner_id`
  const result = isRegularUser(user) || (user && personalWorkspace)
    ? await env.DB.prepare(
        `${fields}
         WHERE pages.domain = ? AND pages.namespace = 'user'
           AND pages.owner_id = ? AND pages.deleted_at IS NULL
         ORDER BY pages.updated_at DESC
         LIMIT 100`
      ).bind(DEFAULT_DOMAIN, user.id).all()
    : await env.DB.prepare(
        `${fields}
         WHERE pages.domain = ? AND pages.deleted_at IS NULL
         ORDER BY pages.updated_at DESC
         LIMIT 100`
      ).bind(normalizeDomain(domain)).all()

  return json({
    pages: (result.results || []).map(({ markdown, ...page }) => ({
      ...page,
      source: page.source || legacyMarkdownWrappedHtml(markdown || ""),
      sourceType: page.source_type || "html",
      titleMode: storedTitleMode(page),
      domain: normalizeDomain(page.domain),
      path: page.path || "",
      ownerId: page.owner_id || PLATFORM_OWNER_ID,
      namespace: page.namespace || "platform",
      username: page.username || "",
      isHome: Boolean(page.is_home),
      faviconUrl: page.favicon_url || "",
      url: pagePublicPath(page),
      fallbackUrl: `/p/${page.id}${page.slug ? `/${page.slug}` : ""}`,
    })),
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const httpsUpgrade = httpsUpgradeResponse(request, url)

    if (httpsUpgrade) {
      return httpsUpgrade
    }

    if (url.hostname === "admin.built.at") {
      return redirectResponse(`https://built.at/admin${url.search}`)
    }

    const subdomainRedirect = mappedSubdomainRedirect(url.hostname, url.pathname, url.search)

    if (subdomainRedirect) {
      return redirectResponse(subdomainRedirect)
    }

    const domain = requestDomain(request)
    const fallbackOrigin = domainFallbackOrigin(domain)

    if (
      fallbackOrigin &&
      url.pathname.startsWith("/api/") &&
      !BUILT_PUBLIC_API_PATHS.has(url.pathname)
    ) {
      return proxyDomainFallback(request, domain)
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 })
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true })
    }

    if (url.pathname === "/api/auth/status" && request.method === "GET") {
      return authStatus(request, env)
    }

    if (url.pathname === "/api/auth/google" && request.method === "GET") {
      return beginGoogleAuth(request, env)
    }

    if (url.pathname === "/api/auth/callback" && request.method === "GET") {
      return finishGoogleAuth(request, env)
    }

    if (url.pathname === "/api/auth/username" && request.method === "GET") {
      return usernameAvailability(request, env)
    }

    if (url.pathname === "/api/auth/username" && request.method === "POST") {
      return chooseUsername(request, env)
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      return logout(request, env)
    }

    if (url.pathname === "/api/system/signup" && request.method === "GET") {
      return getManagedSignupPage(env)
    }

    if (url.pathname === "/signup" && (request.method === "GET" || request.method === "HEAD")) {
      return renderSignup(request, env)
    }

    if (url.pathname.startsWith("/admin") && (request.method === "GET" || request.method === "HEAD")) {
      const user = await currentUser(request, env)
      if (isRegularUser(user) && !user.username) {
        return redirectResponse(new URL("/signup?choose=username", EDITOR_ORIGIN).href)
      }
      return renderAdmin(request, env)
    }

    if (url.pathname === "/api/domain-settings" && request.method === "GET") {
      return domainSettingsResponse(env, url.searchParams.get("domain") || DEFAULT_DOMAIN)
    }

    if (url.pathname === "/api/domain-settings" && request.method === "PATCH") {
      const user = await currentUser(request, env)
      if (isRegularUser(user)) return json({ error: "Site settings are not available for this account." }, { status: 403 })
      return updateDomainSettings(request, env)
    }

    if (
      ["/api/domain-favicon", "/api/domain-favicon-v2"].includes(url.pathname) &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      return renderDomainFavicon(request, env)
    }

    if (url.pathname === "/api/icon" && (request.method === "GET" || request.method === "HEAD")) {
      return renderIcon(request, env)
    }

    if (url.pathname === "/api/icon.ico" && (request.method === "GET" || request.method === "HEAD")) {
      return renderIcon(request, env, { ico: true })
    }

    if (url.pathname === "/api/manifest" && request.method === "GET") {
      return renderManifest(request, env)
    }

    if (url.pathname === "/api/pages" && request.method === "POST") {
      return savePage(request, env, false, await currentUser(request, env))
    }

    if (url.pathname === "/api/pages" && request.method === "GET") {
      return listPages(
        env,
        url.searchParams.get("domain") || DEFAULT_DOMAIN,
        await currentUser(request, env),
        url.searchParams.get("workspace") === "personal"
      )
    }

    if (url.pathname === "/api/trash" && request.method === "GET") {
      return listTrash(
        env,
        url.searchParams.get("domain") || DEFAULT_DOMAIN,
        await currentUser(request, env),
        url.searchParams.get("workspace") === "personal"
      )
    }

    const trashMatch = url.pathname.match(/^\/api\/trash\/([A-Za-z0-9_-]+)$/)
    const trashRestoreMatch = url.pathname.match(/^\/api\/trash\/([A-Za-z0-9_-]+)\/restore$/)

    if (trashRestoreMatch && request.method === "POST") {
      return restorePage(env, trashRestoreMatch[1], await currentUser(request, env))
    }

    if (trashMatch && request.method === "DELETE") {
      return permanentlyDeletePage(env, trashMatch[1], await currentUser(request, env))
    }

    const pageMatch = url.pathname.match(/^\/api\/pages\/([A-Za-z0-9_-]+)$/)

    if (pageMatch && request.method === "GET") {
      return getPage(pageMatch[1], env, await currentUser(request, env))
    }

    if (pageMatch && request.method === "PATCH") {
      return updatePage(request, env, pageMatch[1], await currentUser(request, env))
    }

    if (pageMatch && request.method === "DELETE") {
      return deletePage(env, pageMatch[1], await currentUser(request, env))
    }

    if (url.pathname === "/api/publish" && request.method === "POST") {
      return savePage(request, env, true, await currentUser(request, env))
    }

    if (url.pathname === "/api/shortcut" && request.method === "GET") {
      return openShortcutPage(request, env)
    }

    if (url.pathname === "/api/shortcut" && request.method === "POST") {
      return publishShortcutPage(request, env)
    }

    if (url.pathname === "/api/internal/render-path" && (request.method === "GET" || request.method === "HEAD")) {
      return renderDomainPathRequest(request, env)
    }

    const docMatch = url.pathname.match(/^\/api\/doc\/([A-Za-z0-9_-]+)$/)

    if (docMatch && request.method === "GET") {
      return getPage(docMatch[1], env)
    }

    const publicPageMatch = url.pathname.match(/^\/p\/([A-Za-z0-9_-]+)(?:\/.*)?$/)

    if (publicPageMatch && (request.method === "GET" || request.method === "HEAD")) {
      const row = await env.DB.prepare("SELECT id FROM pages WHERE id = ? AND deleted_at IS NULL")
        .bind(publicPageMatch[1])
        .first()

      if (row) return renderPage(publicPageMatch[1], env)

      const platformPath = url.pathname.replace(/^\/p/, "")
      const platformResponse = await renderPlatformPath(platformPath, env)
      if (platformResponse) return platformResponse
    }

    if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
      const homeResponse = await renderHome(env, domain)

      if (fallbackOrigin && homeResponse.status === 404) {
        return proxyDomainFallback(request, domain)
      }

      return homeResponse
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
      const routeResponse = await renderRoutePath(url.pathname, env, domain)

      if (routeResponse) {
        return routeResponse
      }

      if (domain === DEFAULT_DOMAIN) {
        const [, username = "", userPath = ""] = url.pathname.match(/^\/([^/]+)(?:\/(.*))?$/) || []
        const userResponse = await renderUserPath(username, userPath ? `/${userPath}` : "", env)
        if (userResponse) return userResponse
      }

      if (fallbackOrigin) {
        return proxyDomainFallback(request, domain)
      }

      return notFoundPage({
        pathname: url.pathname,
        message: "There is not a published route at this path yet.",
        faviconUrl: (await getDomainSettings(env, domain)).faviconHref,
      })
    }

    if (fallbackOrigin) {
      return proxyDomainFallback(request, domain)
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    return new Response("Not found", { status: 404 })
  },
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(purgeExpiredTrash(env))
  },
}
