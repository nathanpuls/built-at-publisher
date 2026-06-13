import { marked } from "marked"

const PREVIEW_DEFAULT_FONT_STYLE = `<style data-built-default-font>
  html { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
</style>`

export function redirectUrl(value) {
  const trimmed = String(value || "").trim()

  if (/^https?:\/\/[^\s<>"']+$/i.test(trimmed)) return trimmed

  if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?::\d+)?(?:\/[^\s<>"']*)?$/i.test(trimmed)) {
    return `https://${trimmed}`
  }

  return ""
}

export function detectSource(source) {
  const trimmed = String(source || "").trim()

  if (/^\s*(?:<!doctype\s+html|<[a-z][a-z0-9-]*(?:\s|>|\/>))/i.test(trimmed)) return "html"

  return "markdown"
}

export function titleFromSource(source, fallbackTitle = "") {
  const trimmed = String(source || "").trim()
  const markdownHeading = trimmed.match(/^#\s+(.+)$/m)?.[1]
  const htmlTitle = trimmed.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.replace(/<[^>]+>/g, "")
  const htmlHeading = trimmed.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1]?.replace(/<[^>]+>/g, "")
  const firstLine = trimmed.split("\n").map((line) => line.trim()).find(Boolean)

  if (detectSource(trimmed) === "html") {
    return (htmlTitle || htmlHeading || fallbackTitle || "Untitled").slice(0, 160)
  }

  return (markdownHeading || firstLine || fallbackTitle || "Untitled").slice(0, 160)
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function sanitizeHtml(html) {
  const template = document.createElement("template")
  template.innerHTML = html
  template.content.querySelectorAll("script, iframe, object, embed").forEach((node) => node.remove())
  template.content.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()

      if (name.startsWith("on")) node.removeAttribute(attribute.name)
      if ((name === "href" || name === "src") && /^javascript:/i.test(value)) {
        node.removeAttribute(attribute.name)
      }
    })
  })

  return template.innerHTML
}

export function renderSource(source, type = detectSource(source)) {
  if (type === "redirect") {
    const url = redirectUrl(source)
    return `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`
  }

  if (type === "html") return sanitizeHtml(source)

  return sanitizeHtml(marked.parse(String(source || ""), { gfm: true, breaks: true }))
}

function cleanHtmlInput(source) {
  return String(source || "").replace(/""/g, "\"")
}

export function previewDocument(source, baseUrl = "") {
  const trimmed = cleanHtmlInput(source).trim()
  const baseTag = baseUrl ? `<base href="${escapeHtml(baseUrl)}">` : ""

  if (/<!doctype html|<html[\s>]/i.test(trimmed)) {
    let document = trimmed

    if (baseTag && !/<base\b/i.test(document)) {
      if (/<head[^>]*>/i.test(document)) {
        document = document.replace(/<head([^>]*)>/i, `<head$1>\n  ${baseTag}`)
      } else if (/<\/head>/i.test(document)) {
        document = document.replace(/<\/head>/i, `  ${baseTag}\n</head>`)
      }
    }

    if (/<\/head>/i.test(document) && !/data-built-default-font/i.test(document)) {
      return document.replace(/<\/head>/i, `${PREVIEW_DEFAULT_FONT_STYLE}\n</head>`)
    }

    return document
  }

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${baseTag}
  ${PREVIEW_DEFAULT_FONT_STYLE}
</head>
<body>
${trimmed}
</body>
</html>`
}
