export const DEFAULT_DOMAIN = "built.at"
export const EDITABLE_DOMAINS = ["built.at", "nathanpuls.com"]

export function normalizePath(path) {
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

export function displayPath(path) {
  return normalizePath(path).replace(/^\/+/, "")
}

export function titleFromPath(path) {
  return displayPath(path)
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(/-+/g, " ")
    .trim() || ""
}

export function titleFromPathInput(path) {
  return String(path || "")
    .trim()
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(/\s+/g, " ")
    .trim() || ""
}

function fallbackPath(page) {
  return `/p/${page?.id || "unknown"}${page?.slug ? `/${page.slug}` : ""}`
}

export function publicPath(page) {
  return page?.path || fallbackPath(page)
}

export function publicUrl(page) {
  const domain = page?.domain || DEFAULT_DOMAIN
  return `https://${domain}${publicPath(page)}`
}

export function permanentPath(page) {
  return `p/${page?.id || "unknown"}`
}

export function makePageId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8)
}

export function calculatedTitle(page) {
  const explicitTitle = String(page?.title || "").trim()
  const pathTitle = titleFromPath(page?.path)

  return explicitTitle || titleFromSource(page?.source || "", page?.sourceType || "auto") || pathTitle || ""
}

export function adminPathLabel(page) {
  if (page?.path) return displayPath(page.path)
  return calculatedTitle(page)
}

export function displayTitle(page) {
  return calculatedTitle(page)
}

export function pageTimestamp(page) {
  return Date.parse(page.updatedAt || page.createdAt || "") || 0
}

export function sortPagesNewestFirst(a, b) {
  return pageTimestamp(b) - pageTimestamp(a) || adminPathLabel(a).localeCompare(adminPathLabel(b))
}

export function folderName(page) {
  const path = displayPath(page.path)

  if (!path.includes("/")) return ""

  return path.split("/")[0]
}

export function adminUrlForPage(page) {
  const params = new URLSearchParams()

  if (page?.domain && page.domain !== DEFAULT_DOMAIN) params.set("domain", page.domain)
  if (page?.path) params.set("path", displayPath(page.path))
  else if (page?.id) params.set("id", page.id)

  return `/admin${params.toString() ? `?${params}` : ""}`
}

export function adminHomeUrl(domain = DEFAULT_DOMAIN) {
  return domain === DEFAULT_DOMAIN ? "/admin" : `/admin?domain=${encodeURIComponent(domain)}`
}

export function selectPageFromUrl(pages) {
  const params = new URLSearchParams(window.location.search)
  const path = params.get("path")
  const id = params.get("id")

  if (path) {
    const normalized = normalizePath(path)
    const byPath = pages.find((page) => page.path === normalized)
    if (byPath) return byPath.id
  }

  if (id && pages.some((page) => page.id === id)) return id

  return pages[0]?.id || null
}
import { titleFromSource } from "./content"
