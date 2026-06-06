import { useEffect, useMemo, useRef, useState } from "react"
import { marked } from "marked"

const COLLAPSED_FOLDERS_KEY = "built-routes:collapsed-folders:v1"
const CURRENT_BUILD_ASSET = document.querySelector('script[type="module"][src]')?.getAttribute("src") || ""
const DEFAULT_DOMAIN = "built.at"
const EDITABLE_DOMAINS = ["built.at", "nathanpuls.com"]
const DELETE_UNDO_DURATION_MS = 10000

function normalizePath(path) {
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

function displayPath(path) {
  return normalizePath(path).replace(/^\/+/, "")
}

function fallbackPath(page) {
  return `/p/${page?.id || "unknown"}${page?.slug ? `/${page.slug}` : ""}`
}

function titleFromPath(path) {
  const pathParts = displayPath(path).split("/").filter(Boolean)

  return pathParts.at(-1) || ""
}

function publicPath(page) {
  return page?.path || fallbackPath(page)
}

function publicUrl(page) {
  const domain = page?.domain || DEFAULT_DOMAIN
  return `https://${domain}${publicPath(page)}`
}

function permanentPath(page) {
  return `p/${page?.id || "unknown"}`
}

function makePageId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8)
}

function redirectUrl(value) {
  const trimmed = String(value || "").trim()

  if (/^https?:\/\/[^\s<>"']+$/i.test(trimmed)) return trimmed

  if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?::\d+)?(?:\/[^\s<>"']*)?$/i.test(trimmed)) {
    return `https://${trimmed}`
  }

  return ""
}

function adminPathLabel(page) {
  if (page?.path) return displayPath(page.path)
  return page?.title || titleFromSource(page?.source || "") || "Untitled"
}

function displayTitle(page) {
  const existingTitle = String(page?.title || "").trim()
  const detectedSourceType = detectSource(page?.source || "")
  const sourceType = page?.sourceType === "auto" ? detectedSourceType : (page?.sourceType || detectedSourceType)
  const fallbackTitle = titleFromPath(page?.path)

  if (sourceType === "html" && (!existingTitle || /^<|^!doctype\b/i.test(existingTitle))) {
    return titleFromSource(page?.source || "", fallbackTitle)
  }

  return existingTitle || fallbackTitle || "Untitled"
}

function detectSource(source) {
  const trimmed = String(source || "").trim()

  if (/^\s*(?:<!doctype\s+html|<[a-z][a-z0-9-]*(?:\s|>|\/>))/i.test(trimmed)) return "html"

  return "markdown"
}

function titleFromSource(source, fallbackTitle = "") {
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

function renderSource(source, type = detectSource(source)) {
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

const PREVIEW_DEFAULT_FONT_STYLE = `<style data-built-default-font>
  html { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
</style>`

function previewDocument(source) {
  const trimmed = cleanHtmlInput(source).trim()

  if (/<!doctype html|<html[\s>]/i.test(trimmed)) {
    if (/<\/head>/i.test(trimmed) && !/data-built-default-font/i.test(trimmed)) {
      return trimmed.replace(/<\/head>/i, `${PREVIEW_DEFAULT_FONT_STYLE}\n</head>`)
    }

    return trimmed
  }

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${PREVIEW_DEFAULT_FONT_STYLE}
</head>
<body>
${trimmed}
</body>
</html>`
}

function readCollapsedFolders() {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_FOLDERS_KEY)) || [])
  } catch {
    return new Set()
  }
}

function writeCollapsedFolders(folders) {
  localStorage.setItem(COLLAPSED_FOLDERS_KEY, JSON.stringify(Array.from(folders)))
}

async function readJsonResponse(response) {
  const text = await response.text()

  if (!text.trim()) return {}

  try {
    return JSON.parse(text)
  } catch {
    const summary = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140)

    throw new Error(summary ? `Server returned HTML instead of JSON: ${summary}` : "Server returned HTML instead of JSON.")
  }
}

function typeLabel(type) {
  if (type === "auto") return "Auto"
  if (type === "redirect") return "Link"
  if (type === "iframe") return "Iframe"
  if (type === "html") return "HTML"
  return "Markdown"
}

function TypeMark({ type }) {
  if (type === "redirect") {
    return (
      <span className="kind" data-tooltip="Link">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14">
          <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
          <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
        </svg>
      </span>
    )
  }

  return <span className="kind" data-tooltip={typeLabel(type)}>{type === "auto" ? "AU" : type === "html" ? "</>" : type === "iframe" ? "IF" : "MD"}</span>
}

function pageTimestamp(page) {
  return Date.parse(page.updatedAt || page.createdAt || "") || 0
}

function sortPagesNewestFirst(a, b) {
  return pageTimestamp(b) - pageTimestamp(a) || adminPathLabel(a).localeCompare(adminPathLabel(b))
}

function folderName(page) {
  const path = displayPath(page.path)

  if (!path.includes("/")) return ""

  return path.split("/")[0]
}

function adminUrlForPage(page) {
  const params = new URLSearchParams()

  if (page?.domain && page.domain !== DEFAULT_DOMAIN) params.set("domain", page.domain)
  if (page?.path) params.set("path", displayPath(page.path))
  else if (page?.id) params.set("id", page.id)

  return `/admin${params.toString() ? `?${params}` : ""}`
}

function adminHomeUrl(domain = DEFAULT_DOMAIN) {
  return domain === DEFAULT_DOMAIN ? "/admin" : `/admin?domain=${encodeURIComponent(domain)}`
}

function selectPageFromUrl(pages) {
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

export default function App() {
  const initialDomain = new URLSearchParams(window.location.search).get("domain") || DEFAULT_DOMAIN
  const [activeDomain, setActiveDomain] = useState(EDITABLE_DOMAINS.includes(initialDomain) ? initialDomain : DEFAULT_DOMAIN)
  const [pages, setPages] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState({ path: "", source: "", sourceType: "auto", title: "" })
  const [domainSettings, setDomainSettings] = useState({ faviconUrl: "", loadedDomain: null })
  const [faviconUrlDraft, setFaviconUrlDraft] = useState("")
  const [faviconStatus, setFaviconStatus] = useState("")
  const [isDomainMenuOpen, setIsDomainMenuOpen] = useState(false)
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false)
  const [collapsedFolders, setCollapsedFolders] = useState(readCollapsedFolders)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [copyStatus, setCopyStatus] = useState("")
  const [permanentCopyStatus, setPermanentCopyStatus] = useState("")
  const [sourceCopyStatus, setSourceCopyStatus] = useState("")
  const [sourcePasteStatus, setSourcePasteStatus] = useState("")
  const [homeStatus, setHomeStatus] = useState("")
  const [error, setError] = useState("")
  const [pathError, setPathError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [deletedPage, setDeletedPage] = useState(null)
  const saveTimer = useRef(null)
  const pendingSave = useRef(null)
  const unsavedChangesRef = useRef(false)
  const changeVersionRef = useRef(0)
  const selectedIdRef = useRef(null)
  const keepAdminHomeUrl = useRef(false)
  const focusPathAfterSelect = useRef(false)
  const searchInputRef = useRef(null)
  const pathInputRef = useRef(null)
  const faviconInputRef = useRef(null)
  const domainMenuRef = useRef(null)
  const settingsMenuRef = useRef(null)
  const sourceTextareaRef = useRef(null)
  const selectedPage = pages.find((page) => page.id === selectedId) || null
  const sourceMode = draft.sourceType || "auto"
  const sourceType = sourceMode === "auto" ? detectSource(draft.source) : sourceMode

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    let cancelled = false

    async function loadPages() {
      setIsLoading(true)
      setError("")

      try {
        const response = await fetch(`/api/pages?domain=${encodeURIComponent(activeDomain)}`)
        const data = await readJsonResponse(response)

        if (!response.ok) throw new Error(data.error || "Could not load paths.")

        const normalizedPages = (data.pages || [])
          .map((page) => ({
            ...page,
            path: page.path || "",
            source: page.source || page.markdown || page.html || "",
            sourceType: page.sourceType || "auto",
            domain: page.domain || activeDomain,
            title: page.title || "",
          }))
          .sort(sortPagesNewestFirst)

        if (!cancelled) {
          setPages(normalizedPages)
          setSelectedId((current) => current || selectPageFromUrl(normalizedPages))
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadPages()
    return () => {
      cancelled = true
    }
  }, [activeDomain])

  useEffect(() => {
    let cancelled = false

    async function loadDomainSettings() {
      try {
        const response = await fetch(`/api/domain-settings?domain=${encodeURIComponent(activeDomain)}`)
        const settings = await readJsonResponse(response)

        if (!response.ok) throw new Error(settings.error || "Could not load domain settings.")
        if (!cancelled) {
          setDomainSettings({ ...settings, loadedDomain: activeDomain })
          setFaviconUrlDraft(settings.faviconUrl || "")
        }
      } catch (settingsError) {
        if (!cancelled) setError(settingsError.message)
      }
    }

    loadDomainSettings()
    return () => {
      cancelled = true
    }
  }, [activeDomain])

  useEffect(() => {
    document.title = `Admin | ${activeDomain}`
    if (domainSettings.loadedDomain !== activeDomain) return

    const faviconUrl = domainSettings.faviconHref || domainSettings.faviconUrl || "/favicon-v2.svg"
    const resolvedFaviconUrl = new URL(faviconUrl, window.location.origin).href
    const existingFavicon = document.querySelector('link[rel~="icon"]')

    if (existingFavicon?.href !== resolvedFaviconUrl) {
      document.querySelectorAll('link[rel~="icon"]').forEach((link) => link.remove())

      const favicon = document.createElement("link")
      favicon.rel = "icon"
      favicon.type = "image/svg+xml"
      favicon.sizes = "any"
      favicon.href = resolvedFaviconUrl
      document.head.append(favicon)
    }
  }, [activeDomain, domainSettings.faviconHref, domainSettings.faviconUrl, domainSettings.loadedDomain, domainSettings.updatedAt])

  useEffect(() => {
    if (!selectedPage) return

    // The draft mirrors the selected route so switching routes replaces unsaved UI state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({
      path: displayPath(selectedPage.path || ""),
      source: selectedPage.source || "",
      sourceType: selectedPage.sourceType || "auto",
      title: selectedPage.title || "",
    })

    if (keepAdminHomeUrl.current) {
      keepAdminHomeUrl.current = false
      window.history.replaceState({}, "", adminHomeUrl(activeDomain))
    } else {
      window.history.replaceState({}, "", adminUrlForPage(selectedPage))
    }

    if (focusPathAfterSelect.current) {
      focusPathAfterSelect.current = false
      window.requestAnimationFrame(() => {
        pathInputRef.current?.focus()
        pathInputRef.current?.select()
      })
    }
  }, [selectedPage?.id, activeDomain])

  useEffect(() => {
    writeCollapsedFolders(collapsedFolders)
  }, [collapsedFolders])

  useEffect(() => {
    if (!deletedPage) return undefined

    const timer = window.setTimeout(() => setDeletedPage(null), DELETE_UNDO_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [deletedPage])

  useEffect(() => {
    function closeMenus(event) {
      if (event.key === "Escape") {
        setIsDomainMenuOpen(false)
        setIsSettingsMenuOpen(false)
        return
      }

      if (event.type === "pointerdown") {
        if (!domainMenuRef.current?.contains(event.target)) setIsDomainMenuOpen(false)
        if (!settingsMenuRef.current?.contains(event.target)) setIsSettingsMenuOpen(false)
      }
    }

    document.addEventListener("pointerdown", closeMenus)
    document.addEventListener("keydown", closeMenus)
    return () => {
      document.removeEventListener("pointerdown", closeMenus)
      document.removeEventListener("keydown", closeMenus)
    }
  }, [])

  useEffect(() => {
    function warnAboutUnsavedChanges(event) {
      if (!unsavedChangesRef.current) return
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", warnAboutUnsavedChanges)
    return () => window.removeEventListener("beforeunload", warnAboutUnsavedChanges)
  }, [])

  useEffect(() => {
    let tooltipTimer = null
    let activeTooltip = null

    function hideTooltip(element = activeTooltip) {
      window.clearTimeout(tooltipTimer)
      tooltipTimer = null
      element?.classList.remove("is-tooltip-visible")
      if (element === activeTooltip) activeTooltip = null
    }

    function handleTooltipOver(event) {
      const tooltip = event.target.closest?.("[data-tooltip]")
      if (!tooltip || tooltip.contains(event.relatedTarget)) return

      hideTooltip()
      activeTooltip = tooltip
      tooltipTimer = window.setTimeout(() => {
        if (activeTooltip === tooltip && tooltip.matches(":hover")) {
          tooltip.classList.add("is-tooltip-visible")
        }
      }, 500)
    }

    function handleTooltipOut(event) {
      const tooltip = event.target.closest?.("[data-tooltip]")
      if (!tooltip || tooltip.contains(event.relatedTarget)) return
      hideTooltip(tooltip)
    }

    document.addEventListener("pointerover", handleTooltipOver)
    document.addEventListener("pointerout", handleTooltipOut)

    return () => {
      hideTooltip()
      document.removeEventListener("pointerover", handleTooltipOver)
      document.removeEventListener("pointerout", handleTooltipOut)
    }
  }, [])

  useEffect(() => {
    if (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) return undefined

    let cancelled = false

    async function reloadForNewDeployment() {
      if (cancelled || document.hidden || unsavedChangesRef.current || saveTimer.current || pendingSave.current) return

      try {
        const response = await fetch(`/admin?build-check=${Date.now()}`, { cache: "no-store" })
        const html = await response.text()
        const nextBuildAsset = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i)?.[1]

        if (nextBuildAsset && CURRENT_BUILD_ASSET && nextBuildAsset !== CURRENT_BUILD_ASSET) {
          window.location.reload()
        }
      } catch {
        // A failed update check should never interrupt editing.
      }
    }

    const interval = window.setInterval(reloadForNewDeployment, 3000)
    document.addEventListener("visibilitychange", reloadForNewDeployment)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", reloadForNewDeployment)
    }
  }, [])

  async function saveDraft(nextDraft = draft, options = {}, pageId = selectedPage?.id, changeVersion = changeVersionRef.current) {
    const pageToSave = pages.find((page) => page.id === pageId)
    if (!pageToSave) return

    const isIncompleteFolderPath = /\/\s*$/.test(nextDraft.path || "")
    const isCurrentPage = () => selectedIdRef.current === pageToSave.id

    if (isIncompleteFolderPath) {
      if (isCurrentPage()) {
        setPathError("Finish the path to save")
        setStatus("")
      }
      return
    }

    if (isCurrentPage()) {
      setError("")
      setPathError("")
    }

    try {
      const response = await fetch(`/api/pages/${pageToSave.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          path: normalizePath(nextDraft.path),
          source: nextDraft.source,
          sourceType: nextDraft.sourceType,
          domain: activeDomain,
          title: nextDraft.title.trim(),
          status: "published",
          isHome: options.isHome,
        }),
      })
      const page = await readJsonResponse(response)

      if (!response.ok) throw new Error(page.error || "Could not save route.")

      setPages((current) => current
        .map((entry) => {
          if (options.isHome && entry.id !== page.id) {
            return { ...entry, isHome: false }
          }

          return entry.id === page.id ? { ...entry, ...page } : entry
        })
        .sort(sortPagesNewestFirst))

      if (isCurrentPage()) {
        const normalizedDraftPath = displayPath(page.path)
        if (normalizedDraftPath !== nextDraft.path) {
          setDraft((current) => current.path === nextDraft.path ? { ...current, path: normalizedDraftPath } : current)
        }

        if (options.isHome) {
          setHomeStatus("set")
          window.setTimeout(() => setHomeStatus(""), 1200)
        }

        window.history.replaceState({}, "", adminUrlForPage(page))
      }

      if (changeVersion === changeVersionRef.current && !pendingSave.current && !saveTimer.current) {
        unsavedChangesRef.current = false
      }
    } catch (saveError) {
      if (isCurrentPage()) {
        const message = saveError.name === "TimeoutError"
          ? "Save timed out. Try again."
          : saveError.message || "Could not save route."

        if (/already used|reserved path|finish the path/i.test(message)) {
          setPathError(message)
          setError("")
        } else {
          setError(message)
        }

        setStatus("")
      }
    }
  }

  function scheduleSave(nextDraft) {
    if (nextDraft.path !== draft.path) {
      setPathError("")
    }

    changeVersionRef.current += 1
    unsavedChangesRef.current = true
    setDraft(nextDraft)
    window.clearTimeout(saveTimer.current)
    pendingSave.current = { draft: nextDraft, pageId: selectedPage?.id, changeVersion: changeVersionRef.current }
    saveTimer.current = window.setTimeout(() => {
      const pending = pendingSave.current
      saveTimer.current = null
      pendingSave.current = null

      if (pending) saveDraft(pending.draft, {}, pending.pageId, pending.changeVersion)
    }, 500)
  }

  function flushPendingSave() {
    if (!saveTimer.current || !pendingSave.current) return

    const pending = pendingSave.current
    window.clearTimeout(saveTimer.current)
    saveTimer.current = null
    pendingSave.current = null
    saveDraft(pending.draft, {}, pending.pageId, pending.changeVersion)
  }

  async function createPage() {
    setError("")

    if (selectedPage && !draft.source.trim()) {
      setStatus("Add source before creating another route")
      window.setTimeout(() => setStatus(""), 1800)
      pathInputRef.current?.focus()
      return
    }

    setStatus("Creating")

    try {
      const response = await fetch("/api/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: "",
          domain: activeDomain,
          sourceType: "auto",
          title: "",
          status: "published",
        }),
      })
      const page = await readJsonResponse(response)

      if (!response.ok) throw new Error(page.error || "Could not create route.")

      setPages((current) => [page, ...current].sort(sortPagesNewestFirst))
      setQuery("")
      setDeletedPage(null)
      focusPathAfterSelect.current = true
      setSelectedId(page.id)
      setStatus("")
    } catch (createError) {
      setError(createError.message)
      setStatus("")
    }
  }

  async function deleteRoute(page) {
    flushPendingSave()
    setError("")
    setStatus("")

    try {
      const response = await fetch(`/api/pages/${page.id}`, { method: "DELETE" })
      const data = await readJsonResponse(response)

      if (!response.ok) throw new Error(data.error || "Could not delete route.")

      setDeletedPage(page)
      setPages((current) => {
        const next = current.filter((entry) => entry.id !== page.id)

        if (page.id === selectedId) {
          const nextSelected = next[0]?.id || null
          setSelectedId(nextSelected)
          window.history.replaceState({}, "", nextSelected ? adminUrlForPage(next[0]) : adminHomeUrl(activeDomain))
        }

        return next
      })
    } catch (deleteError) {
      setError(deleteError.message)
      setStatus("")
    }
  }

  async function undoDelete() {
    if (!deletedPage) return

    setError("")
    setStatus("Restoring")

    try {
      const response = await fetch("/api/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: deletedPage.id,
          path: deletedPage.path,
          source: deletedPage.source || "",
          sourceType: deletedPage.sourceType,
          domain: deletedPage.domain || activeDomain,
          title: deletedPage.title || "Untitled",
          status: deletedPage.status || "published",
        }),
      })
      const page = await readJsonResponse(response)

      if (!response.ok) throw new Error(page.error || "Could not restore route.")

      if (deletedPage.isHome) {
        await fetch(`/api/pages/${page.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            path: page.path,
            source: page.source || "",
            sourceType: page.sourceType,
            domain: page.domain || activeDomain,
            title: page.title || "Untitled",
            status: page.status || "published",
            isHome: true,
          }),
        })
      }

      setPages((current) => [page, ...current.filter((entry) => entry.id !== page.id)]
        .map((entry) => deletedPage.isHome && entry.id === page.id ? { ...entry, isHome: true } : entry)
        .sort(sortPagesNewestFirst))
      setSelectedId(page.id)
      setDeletedPage(null)
      setStatus("Restored")
      window.setTimeout(() => setStatus(""), 1200)
    } catch (restoreError) {
      setError(restoreError.message)
      setStatus("")
    }
  }

  function selectPage(page) {
    flushPendingSave()
    setIsSettingsMenuOpen(false)
    setPathError("")
    setPermanentCopyStatus("")
    setSourceCopyStatus("")
    setSourcePasteStatus("")
    setSelectedId(page.id)
    window.history.pushState({}, "", adminUrlForPage(page))
  }

  function resetAdminHome() {
    flushPendingSave()
    setIsSettingsMenuOpen(false)
    setQuery("")
    setError("")
    setStatus("")
    setCopyStatus("")
    setPermanentCopyStatus("")
    setSourceCopyStatus("")
    setSourcePasteStatus("")
    setHomeStatus("")
    setPathError("")
    keepAdminHomeUrl.current = true
    setSelectedId(pages[0]?.id || null)
    window.history.pushState({}, "", adminHomeUrl(activeDomain))
  }

  function toggleFolder(folder) {
    setCollapsedFolders((current) => {
      const next = new Set(current)
      if (next.has(folder)) next.delete(folder)
      else next.add(folder)
      return next
    })
  }

  function clearSearch() {
    setQuery("")
    searchInputRef.current?.focus()
  }

  async function copyText(value, setCopyState) {
    try {
      await navigator.clipboard.writeText(value)
      setError("")
      setCopyState("copied")
      window.setTimeout(() => setCopyState(""), 1200)
    } catch {
      setError("Could not copy to the clipboard.")
    }
  }

  function copyPublicUrl() {
    if (!selectedPage) return
    copyText(publicUrl(selectedPage), setCopyStatus)
  }

  function copyPermanentUrl() {
    if (!selectedPage) return
    copyText(new URL(`/${permanentPath(selectedPage)}`, window.location.origin).href, setPermanentCopyStatus)
  }

  function copySource() {
    copyText(draft.source, setSourceCopyStatus)
  }

  async function pasteSource() {
    try {
      const source = await navigator.clipboard.readText()
      setError("")
      setSourcePasteStatus("pasted")
      scheduleSave({ ...draft, source })
      window.setTimeout(() => setSourcePasteStatus(""), 1200)
    } catch {
      setError("Could not read from the clipboard.")
    }
  }

  async function duplicateSource() {
    if (!draft.source.trim()) {
      setError("Add source before duplicating this page.")
      return
    }

    flushPendingSave()
    setError("")
    setStatus("Creating")

    try {
      const response = await fetch("/api/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: makePageId(),
          path: "",
          content: draft.source,
          sourceType: draft.sourceType,
          domain: activeDomain,
          title: draft.title || titleFromSource(draft.source),
          status: "published",
          allowDuplicate: true,
        }),
      })
      const page = await readJsonResponse(response)

      if (!response.ok) throw new Error(page.error || "Could not duplicate route.")

      setPages((current) => [page, ...current].sort(sortPagesNewestFirst))
      setQuery("")
      setDeletedPage(null)
      focusPathAfterSelect.current = true
      setSelectedId(page.id)
      setStatus("")
    } catch (duplicateError) {
      setError(duplicateError.message || "Could not duplicate route.")
      setStatus("")
    }
  }

  useEffect(() => {
    function handleShortcut(event) {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) return

      const key = event.key.toLowerCase()

      if (key === "/") {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      if (key === "n") {
        event.preventDefault()
        createPage()
        return
      }

      if (!selectedPage) return

      if (key === "p") {
        event.preventDefault()
        pathInputRef.current?.focus()
        pathInputRef.current?.select()
      } else if (key === "s") {
        event.preventDefault()
        sourceTextareaRef.current?.focus()
      } else if (key === "o") {
        event.preventDefault()
        const openedPage = window.open(publicUrl(selectedPage), "_blank", "noopener,noreferrer")
        if (openedPage) openedPage.opener = null
      } else if (key === "u") {
        event.preventDefault()
        copyPublicUrl()
      } else if (key === "v") {
        event.preventDefault()
        pasteSource()
      } else if (key === "c") {
        event.preventDefault()
        copySource()
      } else if (key === "d") {
        event.preventDefault()
        duplicateSource()
      } else if (key === "h" && !selectedPage.isHome) {
        event.preventDefault()
        saveDraft(draft, { isHome: true })
      }
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  })

  const filteredPages = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase()
    if (!lowerQuery) return pages

    return pages.filter((page) => {
      const homeLabel = page.isHome ? "home current home homepage" : ""
      const haystack = `${page.domain || DEFAULT_DOMAIN} ${adminPathLabel(page)} ${displayTitle(page)} ${permanentPath(page)} ${page.title} ${page.sourceType} ${homeLabel} ${page.source || ""}`.toLowerCase()
      return haystack.includes(lowerQuery)
    })
  }, [pages, query])

  const sidebarEntries = useMemo(() => {
    if (query.trim()) {
      return filteredPages.map((page) => ({ type: "page", page, timestamp: pageTimestamp(page) }))
    }

    const entries = []
    const folders = new Map()

    filteredPages.forEach((page) => {
      const folder = folderName(page)
      if (!folder) {
        entries.push({ type: "page", page, timestamp: pageTimestamp(page) })
        return
      }

      if (!folders.has(folder)) folders.set(folder, [])
      folders.get(folder).push(page)
    })

    folders.forEach((folderPages, folder) => {
      folderPages.sort(sortPagesNewestFirst)
      entries.push({ type: "folder", folder, pages: folderPages, timestamp: pageTimestamp(folderPages[0]) })
    })

    return entries.sort((a, b) => b.timestamp - a.timestamp)
  }, [filteredPages, query])

  function switchDomain(domain) {
    if (domain === activeDomain) {
      setIsDomainMenuOpen(false)
      return
    }

    flushPendingSave()
    setActiveDomain(domain)
    setPages([])
    setSelectedId(null)
    setDomainSettings({ faviconUrl: "", loadedDomain: null })
    setFaviconUrlDraft("")
    setDeletedPage(null)
    setQuery("")
    setIsDomainMenuOpen(false)
    setIsSettingsMenuOpen(false)
    const params = new URLSearchParams()
    if (domain !== DEFAULT_DOMAIN) params.set("domain", domain)
    window.history.pushState({}, "", adminHomeUrl(domain))
  }

  function changeSourceType(nextSourceType) {
    scheduleSave({ ...draft, sourceType: nextSourceType })
  }

  async function uploadFavicon(event) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setError("")
    setFaviconStatus("Uploading")

    try {
      const form = new FormData()
      form.append("file", file)
      const uploadResponse = await fetch("/api/media", { method: "POST", body: form })
      const upload = await readJsonResponse(uploadResponse)

      if (!uploadResponse.ok) throw new Error(upload.error || "Could not upload favicon.")

      const settingsResponse = await fetch("/api/domain-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: activeDomain, faviconUrl: upload.url }),
      })
      const settings = await readJsonResponse(settingsResponse)

      if (!settingsResponse.ok) throw new Error(settings.error || "Could not save favicon.")

      setDomainSettings({ ...settings, loadedDomain: activeDomain })
      setFaviconUrlDraft(settings.faviconUrl || "")
      setFaviconStatus("Saved")
      window.setTimeout(() => setFaviconStatus(""), 1200)
    } catch (faviconError) {
      setError(faviconError.message || "Could not update favicon.")
      setFaviconStatus("")
    }
  }

  async function saveFaviconUrl(faviconUrl) {
    setError("")
    setFaviconStatus("Saving")

    try {
      const settingsResponse = await fetch("/api/domain-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: activeDomain, faviconUrl: faviconUrl.trim() }),
      })
      const settings = await readJsonResponse(settingsResponse)

      if (!settingsResponse.ok) throw new Error(settings.error || "Could not save favicon.")

      setDomainSettings({ ...settings, loadedDomain: activeDomain })
      setFaviconUrlDraft(settings.faviconUrl || "")
      setFaviconStatus("Saved")
      window.setTimeout(() => setFaviconStatus(""), 1200)
    } catch (faviconError) {
      setError(faviconError.message || "Could not update favicon.")
      setFaviconStatus("")
    }
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <header className="sidebar-header">
          <div className="domain-switcher" ref={domainMenuRef}>
            <button
              className="domain-menu-trigger"
              type="button"
              onClick={() => {
                setIsDomainMenuOpen((current) => !current)
              }}
              aria-label="Switch domain"
              aria-expanded={isDomainMenuOpen}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <input ref={faviconInputRef} className="visually-hidden" type="file" accept="image/*" onChange={uploadFavicon} />
            <button className="routes-home" type="button" onClick={resetAdminHome}>
              {activeDomain}
            </button>
            {isDomainMenuOpen ? (
              <div className="domain-menu">
                {EDITABLE_DOMAINS.map((domain) => (
                  <button
                    className={domain === activeDomain ? "is-active" : ""}
                    type="button"
                    onClick={() => switchDomain(domain)}
                    key={domain}
                  >
                    <span>{domain}</span>
                    {domain === activeDomain ? <span aria-hidden="true">✓</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button className="primary" type="button" onClick={createPage} aria-label="New path" aria-keyshortcuts="n">New</button>
        </header>

        <div className="search-row">
          <div className="search-control">
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && query) {
                  event.preventDefault()
                  clearSearch()
                }
              }}
              placeholder="Search paths and content"
              aria-keyshortcuts="/ Escape"
            />
            {query ? (
              <button className="clear-search" type="button" onClick={clearSearch} aria-label="Clear search" title="Clear search">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="m7 7 10 10M17 7 7 17" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        <div className="items">
          {isLoading ? <p className="empty-state">Loading paths</p> : null}
          {!isLoading && filteredPages.length === 0 ? <p className="empty-state">No paths found</p> : null}
          {sidebarEntries.map((entry) => entry.type === "page" ? (
            <PageList pages={[entry.page]} selectedId={selectedId} onSelect={selectPage} onDelete={deleteRoute} key={entry.page.id} />
          ) : (
            <div className={`folder-group ${collapsedFolders.has(entry.folder) ? "is-collapsed" : ""}`} key={entry.folder}>
              <button className="folder-label" type="button" onClick={() => toggleFolder(entry.folder)} aria-expanded={!collapsedFolders.has(entry.folder)}>
                <span className="folder-caret" aria-hidden="true">›</span>
                <span>{entry.folder}</span>
              </button>
              <div className="folder-items">
                <PageList pages={entry.pages} selectedId={selectedId} onSelect={selectPage} onDelete={deleteRoute} />
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          {selectedPage ? (
            <>
              <div className="header-path-field">
                <span className="header-path-input">
                  <span className="header-path-label">Path</span>
                  <input
                    ref={pathInputRef}
                    value={draft.path}
                    aria-label="Path"
                    aria-invalid={Boolean(pathError)}
                    aria-describedby={pathError ? "path-error" : undefined}
                    aria-keyshortcuts="p"
                    onChange={(event) => scheduleSave({ ...draft, path: event.target.value })}
                  />
                  {pathError ? <span className="field-error" id="path-error">{pathError}</span> : null}
                </span>
                <span className="header-title-input">
                  <span className="header-path-label">Title</span>
                  <input
                    value={draft.title}
                    aria-label="Page title"
                    onChange={(event) => scheduleSave({ ...draft, title: event.target.value })}
                  />
                </span>
                <button
                  className={`permanent-link-action ${permanentCopyStatus ? "is-copied" : ""}`}
                  type="button"
                  onClick={copyPermanentUrl}
                  title="Copy permalink"
                >
                  <span>{permanentPath(selectedPage)}</span>
                  <span className="permalink-copy-icon" aria-live="polite">
                    {permanentCopyStatus ? (
                      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                        <rect x="9" y="9" width="10" height="10" rx="2" />
                        <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                      </svg>
                    )}
                  </span>
                </button>
              </div>
              <div className="path-actions">
                <div className="settings-control" ref={settingsMenuRef}>
                  <button
                    className="settings-trigger"
                    type="button"
                    onClick={() => {
                      setIsDomainMenuOpen(false)
                      setIsSettingsMenuOpen((current) => !current)
                    }}
                    aria-label={`Settings for ${activeDomain}`}
                    aria-expanded={isSettingsMenuOpen}
                  >
                    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
                    </svg>
                  </button>
                  {isSettingsMenuOpen ? (
                    <div className="settings-menu">
                      <div className="domain-settings-heading">
                        <span className="domain-settings-favicon">
                          {domainSettings.faviconUrl ? <img src={domainSettings.faviconUrl} alt="" /> : <span aria-hidden="true">?</span>}
                        </span>
                        <span>
                          <strong>Settings</strong>
                          <small>{activeDomain}</small>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSettingsMenuOpen(false)
                          faviconInputRef.current?.click()
                        }}
                      >
                        <span>Choose favicon</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                      <div className="favicon-url-control">
                        <input
                          value={faviconUrlDraft}
                          onChange={(event) => setFaviconUrlDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") saveFaviconUrl(faviconUrlDraft)
                          }}
                          placeholder="Image URL"
                          aria-label="Favicon image URL"
                        />
                        <button type="button" onClick={() => saveFaviconUrl(faviconUrlDraft)}>Apply</button>
                      </div>
                      {domainSettings.recentFavicons?.length ? (
                        <div className="recent-favicons">
                          <span>Recent</span>
                          <div>
                            {domainSettings.recentFavicons.map((favicon) => (
                              <button
                                className={favicon.faviconUrl === domainSettings.faviconUrl ? "is-current" : ""}
                                type="button"
                                onClick={() => saveFaviconUrl(favicon.faviconUrl)}
                                aria-label="Use recent favicon"
                                title={favicon.faviconUrl}
                                key={`${favicon.faviconUrl}-${favicon.createdAt}`}
                              >
                                <img src={favicon.faviconUrl} alt="" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {faviconStatus ? <span className="domain-settings-status">{faviconStatus}</span> : null}
                    </div>
                  ) : null}
                </div>
                <button className={`button copy-action ${copyStatus ? "is-copied" : ""}`} type="button" onClick={copyPublicUrl} aria-keyshortcuts="u">
                  {copyStatus ? "Copied" : "Copy URL"}
                </button>
                <a className="button open-action" href={publicUrl(selectedPage)} target="_blank" rel="noreferrer" aria-keyshortcuts="o">Open</a>
                <span className={`action-status ${error ? "is-error" : ""}`}>{error || status}</span>
              </div>
            </>
          ) : null}
        </header>
        {selectedPage ? (
          <div className="editor">
            <div className="form-grid">
              <div className="source-area">
                <div className="field-label source-label">
                  <span className="source-heading">
                    <span>Source</span>
                    <select value={sourceMode} onChange={(event) => changeSourceType(event.target.value)} aria-label="Page mode">
                      <option value="auto">{`Auto (${sourceType === "html" ? "HTML" : "Markdown"})`}</option>
                      <option value="markdown">Markdown</option>
                      <option value="html">HTML</option>
                      <option value="redirect">Redirect</option>
                      <option value="iframe">Iframe</option>
                    </select>
                  </span>
                  <span className="source-field-actions">
                        <button
                          className={`source-tool-action ${sourceCopyStatus ? "is-success" : ""}`}
                          type="button"
                          onClick={copySource}
                          data-tooltip="Copy source (C)"
                          aria-label={sourceCopyStatus ? "Source copied" : "Copy source"}
                          aria-keyshortcuts="c"
                        >
                          {sourceCopyStatus ? (
                            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                              <path d="m5 12 4 4L19 6" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                              <rect x="9" y="9" width="10" height="10" rx="2" />
                              <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                            </svg>
                          )}
                        </button>
                        <button
                          className={`source-tool-action ${sourcePasteStatus ? "is-success" : ""}`}
                          type="button"
                          onClick={pasteSource}
                          data-tooltip={sourcePasteStatus ? "Source pasted" : "Paste source (V)"}
                          aria-label={sourcePasteStatus ? "Source pasted" : "Paste source"}
                          aria-keyshortcuts="v"
                        >
                          {sourcePasteStatus ? (
                            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                              <path d="m5 12 4 4L19 6" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                              <path d="M9 5h6" />
                              <path d="M9 3h6v4H9z" />
                              <path d="M7 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1" />
                            </svg>
                          )}
                        </button>
                        <button
                          className="source-tool-action"
                          type="button"
                          onClick={duplicateSource}
                          data-tooltip="Duplicate into new page (D)"
                          aria-label="Duplicate source into a new page"
                          aria-keyshortcuts="d"
                        >
                          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                            <rect x="8" y="8" width="11" height="11" rx="2" />
                            <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                            <path d="M13.5 11v5M11 13.5h5" />
                          </svg>
                        </button>
                        <button
                          className={`source-tool-action home-tool-action ${selectedPage.isHome || homeStatus ? "is-home" : ""}`}
                          type="button"
                          onClick={() => {
                            if (!selectedPage.isHome) saveDraft(draft, { isHome: true })
                          }}
                          data-tooltip={selectedPage.isHome ? "Home path" : "Set as home (H)"}
                          aria-label={selectedPage.isHome ? "Home path" : "Set as home"}
                          aria-keyshortcuts="h"
                          aria-pressed={selectedPage.isHome}
                        >
                          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                            <path d="m3 11 9-8 9 8" />
                            <path d="M5 10v10h14V10" />
                            <path d="M9 20v-6h6v6" />
                          </svg>
                        </button>
                  </span>
                </div>
                <div className="source-field">
                <textarea
                  ref={sourceTextareaRef}
                  value={draft.source}
                  onChange={(event) => scheduleSave({ ...draft, source: event.target.value })}
                  aria-keyshortcuts="s"
                  spellCheck="false"
                />
                </div>
              </div>

              <section className={`preview is-${sourceType}`}>
                  <div className="preview-label">Preview</div>
                  {sourceType === "iframe" ? (
                    <iframe
                      className="html-preview"
                      title="Iframe preview"
                      src={redirectUrl(draft.source) || "about:blank"}
                      allow="autoplay; clipboard-read; clipboard-write; fullscreen"
                    />
                  ) : sourceType === "html" ? (
                    <iframe
                      className="html-preview"
                      title="HTML preview"
                      sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                      srcDoc={previewDocument(draft.source)}
                    />
                  ) : (
                    <article
                      className={`rendered is-${sourceType}`}
                      dangerouslySetInnerHTML={{ __html: renderSource(draft.source, sourceType) }}
                    />
                  )}
              </section>
            </div>
          </div>
        ) : (
          <div className="blank-workspace">
            No route selected
          </div>
        )}
      </main>
      {deletedPage ? (
        <div className="undo-bar" role="status" aria-live="polite">
          <span>
            Deleted <strong>{adminPathLabel(deletedPage)}</strong>
          </span>
          <button type="button" onClick={undoDelete}>Undo</button>
        </div>
      ) : null}
    </div>
  )
}

function PageList({ pages, selectedId, onSelect, onDelete }) {
  return pages.map((page) => {
    const sourceType = page.sourceType || detectSource(page.source)

    return (
      <div className={`item ${page.id === selectedId ? "is-active" : ""}`} data-id={page.id} key={page.id}>
        <button className="item-main" type="button" onClick={() => onSelect(page)}>
          <span className="path-row">
            <span className={`path ${page.path ? "" : "is-temporary"}`}>{adminPathLabel(page)}</span>
            {page.isHome ? <span className="home-pill">Home</span> : null}
          </span>
          <span className="meta">{page.path ? displayTitle(page) : permanentPath(page)}</span>
        </button>
        <TypeMark type={sourceType} />
        <button className="delete-route" type="button" data-tooltip="Delete path" aria-label={`Delete ${adminPathLabel(page)}`} onClick={() => onDelete(page)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v5" />
            <path d="M14 11v5" />
          </svg>
        </button>
      </div>
    )
  })
}
