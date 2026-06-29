import { useEffect, useMemo, useRef, useState } from "react"
import { EditorHeader } from "./components/EditorHeader"
import { EditorWorkspace } from "./components/EditorWorkspace"
import { Sidebar } from "./components/Sidebar"
import { detectSource, titleFromSource } from "./lib/content"
import {
  DEFAULT_DOMAIN,
  EDITABLE_DOMAINS,
  adminHomeUrl,
  adminPathLabel,
  adminUrlForPage,
  displayPath,
  displayTitle,
  folderName,
  makePageId,
  normalizePath,
  pageTimestamp,
  permanentPath,
  publicUrl,
  selectPageFromUrl,
  sortPagesNewestFirst,
  titleFromPath,
  titleFromPathInput,
} from "./lib/pages"

const COLLAPSED_FOLDERS_KEY = "built-routes:collapsed-folders:v1"
const CURRENT_BUILD_ASSET = document.querySelector('script[type="module"][src]')?.getAttribute("src") || ""
const DELETE_UNDO_DURATION_MS = 10000

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

function suggestedDraftTitle(candidate, currentDraft = null, pathChanged = false) {
  const sourceType = candidate.sourceType === "auto" ? detectSource(candidate.source) : candidate.sourceType
  const sourceTitle = titleFromSource(candidate.source, sourceType)

  if (sourceTitle) return sourceTitle
  if (pathChanged) return titleFromPathInput(candidate.path)

  const currentSourceType = currentDraft?.sourceType === "auto" ? detectSource(currentDraft.source) : currentDraft?.sourceType
  const currentSourceTitle = currentDraft ? titleFromSource(currentDraft.source, currentSourceType) : ""
  const currentTitle = currentDraft?.title?.trim() || ""

  if (currentTitle && currentTitle !== currentSourceTitle) return currentTitle
  return titleFromPath(candidate.path)
}

function withSuggestedTitle(nextDraft, currentDraft, { pathChanged = false } = {}) {
  const titleIsAutomatic = currentDraft.titleMode !== "manual"

  return titleIsAutomatic
    ? { ...nextDraft, title: suggestedDraftTitle(nextDraft, currentDraft, pathChanged), titleMode: "auto" }
    : nextDraft
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

export default function App() {
  const initialParams = new URLSearchParams(window.location.search)
  const initialDomain = initialParams.get("domain") || DEFAULT_DOMAIN
  const [activeDomain, setActiveDomain] = useState(EDITABLE_DOMAINS.includes(initialDomain) ? initialDomain : DEFAULT_DOMAIN)
  const [account, setAccount] = useState(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [workspaceMode, setWorkspaceMode] = useState(initialParams.get("workspace") === "personal" ? "personal" : "platform")
  const [pages, setPages] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState({ path: "", source: "", sourceType: "auto", title: "", titleMode: "auto" })
  const [domainSettings, setDomainSettings] = useState({ faviconUrl: "", loadedDomain: null })
  const [faviconUrlDraft, setFaviconUrlDraft] = useState("")
  const [pageFaviconUrlDraft, setPageFaviconUrlDraft] = useState("")
  const [faviconStatus, setFaviconStatus] = useState("")
  const [isDomainMenuOpen, setIsDomainMenuOpen] = useState(false)
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false)
  const [isCopyMenuOpen, setIsCopyMenuOpen] = useState(false)
  const [collapsedFolders, setCollapsedFolders] = useState(readCollapsedFolders)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [copyStatus, setCopyStatus] = useState("")
  const [permanentCopyStatus, setPermanentCopyStatus] = useState("")
  const [sourceCopyStatus, setSourceCopyStatus] = useState("")
  const [sourcePasteStatus, setSourcePasteStatus] = useState("")
  const [homeStatus, setHomeStatus] = useState("")
  const [editorView, setEditorView] = useState("split")
  const [error, setError] = useState("")
  const [pathError, setPathError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [deletedPage, setDeletedPage] = useState(null)
  const [isTrashOpen, setIsTrashOpen] = useState(false)
  const [isTrashLoading, setIsTrashLoading] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [trashPages, setTrashPages] = useState([])
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
  const pageFaviconInputRef = useRef(null)
  const domainMenuRef = useRef(null)
  const settingsMenuRef = useRef(null)
  const copyMenuRef = useRef(null)
  const sourceTextareaRef = useRef(null)
  const selectedPage = pages.find((page) => page.id === selectedId) || null
  const sourceMode = draft.sourceType || "auto"
  const sourceType = sourceMode === "auto" ? detectSource(draft.source) : sourceMode
  const isPersonalWorkspace = Boolean(account && (account.role !== "owner" || workspaceMode === "personal"))
  const isUserWorkspace = isPersonalWorkspace

  useEffect(() => {
    let cancelled = false

    fetch("/api/auth/status")
      .then(readJsonResponse)
      .then((data) => {
        if (cancelled) return
        if (data.needsUsername) {
          window.location.replace("/signup?choose=username")
          return
        }
        setAccount(data.user || null)
        if (data.user && data.user.role !== "owner") {
          setActiveDomain(DEFAULT_DOMAIN)
          setWorkspaceMode("personal")
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAuthLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    let cancelled = false

    async function loadPages() {
      if (!authLoaded) return
      setIsLoading(true)
      setError("")

      try {
        const params = new URLSearchParams({ domain: activeDomain })
        if (isPersonalWorkspace) params.set("workspace", "personal")
        const response = await fetch(`/api/pages?${params}`)
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
            titleMode: page.titleMode || "manual",
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
  }, [activeDomain, authLoaded, isPersonalWorkspace])

  useEffect(() => {
    let cancelled = false

    async function loadTrash() {
      if (!authLoaded) return
      setIsTrashLoading(true)

      try {
        const params = new URLSearchParams({ domain: activeDomain })
        if (isPersonalWorkspace) params.set("workspace", "personal")
        const response = await fetch(`/api/trash?${params}`)
        const data = await readJsonResponse(response)

        if (!response.ok) throw new Error(data.error || "Could not load trash.")
        if (!cancelled) setTrashPages(data.pages || [])
      } catch (trashError) {
        if (!cancelled) setError(trashError.message)
      } finally {
        if (!cancelled) setIsTrashLoading(false)
      }
    }

    loadTrash()
    return () => {
      cancelled = true
    }
  }, [activeDomain, authLoaded, isPersonalWorkspace])

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
  }, [activeDomain, domainSettings.effectiveFaviconUrl, domainSettings.faviconHref, domainSettings.faviconUrl, domainSettings.loadedDomain, domainSettings.updatedAt])

  useEffect(() => {
    if (!selectedPage) return

    // The draft mirrors the selected route so switching routes replaces unsaved UI state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({
      path: displayPath(selectedPage.path || ""),
      source: selectedPage.source || "",
      sourceType: selectedPage.sourceType || "auto",
      title: selectedPage.title || "",
      titleMode: selectedPage.titleMode || "manual",
    })
    setPageFaviconUrlDraft(selectedPage.faviconUrl || "")

    if (keepAdminHomeUrl.current) {
      keepAdminHomeUrl.current = false
      window.history.replaceState({}, "", adminHomeUrl(activeDomain, isPersonalWorkspace ? "personal" : "platform"))
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
  }, [selectedPage?.id, activeDomain, isPersonalWorkspace])

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
        if (isTrashOpen) {
          event.preventDefault()
          setIsTrashOpen(false)
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        }
        setIsMobileSidebarOpen(false)
        setIsDomainMenuOpen(false)
        setIsSettingsMenuOpen(false)
        setIsCopyMenuOpen(false)
        return
      }

      if (event.type === "pointerdown") {
        if (!domainMenuRef.current?.contains(event.target)) setIsDomainMenuOpen(false)
        if (!settingsMenuRef.current?.contains(event.target)) setIsSettingsMenuOpen(false)
        if (!copyMenuRef.current?.contains(event.target)) setIsCopyMenuOpen(false)
      }
    }

    function closeMenusOnWindowBlur() {
      setIsDomainMenuOpen(false)
      setIsSettingsMenuOpen(false)
      setIsCopyMenuOpen(false)
    }

    document.addEventListener("pointerdown", closeMenus, true)
    document.addEventListener("keydown", closeMenus)
    window.addEventListener("blur", closeMenusOnWindowBlur)
    return () => {
      document.removeEventListener("pointerdown", closeMenus, true)
      document.removeEventListener("keydown", closeMenus)
      window.removeEventListener("blur", closeMenusOnWindowBlur)
    }
  }, [isTrashOpen])

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
      element?.style.removeProperty("--tooltip-left")
      element?.style.removeProperty("--tooltip-top")
      element?.removeAttribute("data-tooltip-placement")
      if (element === activeTooltip) activeTooltip = null
    }

    function positionTooltip(tooltip) {
      const rect = tooltip.getBoundingClientRect()
      const halfTooltipWidth = 100
      const left = Math.max(halfTooltipWidth + 8, Math.min(window.innerWidth - halfTooltipWidth - 8, rect.left + (rect.width / 2)))
      const showAbove = window.innerHeight - rect.bottom < 48 && rect.top > 48

      tooltip.style.setProperty("--tooltip-left", `${left}px`)
      tooltip.style.setProperty("--tooltip-top", `${showAbove ? rect.top - 7 : rect.bottom + 7}px`)
      tooltip.dataset.tooltipPlacement = showAbove ? "above" : "below"
    }

    function handleTooltipOver(event) {
      const tooltip = event.target.closest?.("[data-tooltip]")
      if (!tooltip || tooltip.contains(event.relatedTarget)) return

      hideTooltip()
      activeTooltip = tooltip
      tooltipTimer = window.setTimeout(() => {
        if (activeTooltip === tooltip && tooltip.matches(":hover")) {
          positionTooltip(tooltip)
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
          titleMode: nextDraft.titleMode,
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
        if (normalizedDraftPath !== nextDraft.path || page.title !== nextDraft.title) {
          setDraft((current) => current.path === nextDraft.path && current.title === nextDraft.title
            ? { ...current, path: normalizedDraftPath, title: page.title || "" }
            : current)
        }

        if (options.isHome !== undefined) {
          setHomeStatus(options.isHome ? "set" : "unset")
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
          titleMode: "auto",
          status: "published",
          namespace: isPersonalWorkspace ? "user" : "platform",
          ownerId: isPersonalWorkspace ? account?.id : undefined,
        }),
      })
      const page = await readJsonResponse(response)

      if (!response.ok) throw new Error(page.error || "Could not create route.")

      setPages((current) => [page, ...current].sort(sortPagesNewestFirst))
      setQuery("")
      setDeletedPage(null)
      focusPathAfterSelect.current = true
      setSelectedId(page.id)
      setIsMobileSidebarOpen(false)
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
      setTrashPages((current) => [{ ...page, deletedAt: data.deletedAt }, ...current.filter((entry) => entry.id !== page.id)])
      setPages((current) => {
        const next = current.filter((entry) => entry.id !== page.id)

        if (page.id === selectedId) {
          const nextSelected = next[0]?.id || null
          setSelectedId(nextSelected)
          window.history.replaceState({}, "", nextSelected ? adminUrlForPage(next[0]) : adminHomeUrl(activeDomain, isPersonalWorkspace ? "personal" : "platform"))
        }

        return next
      })
    } catch (deleteError) {
      setError(deleteError.message)
      setStatus("")
    }
  }

  async function deleteFolder(folderPages) {
    if (!folderPages.length) return

    const folder = folderName(folderPages[0])
    const pathCount = folderPages.length
    const pathLabel = pathCount === 1 ? "path" : "paths"
    const confirmed = window.confirm(
      `Move the “${folder}” folder and its ${pathCount} ${pathLabel} to Trash?\n\nThey can be recovered for 30 days.`
    )

    if (!confirmed) return

    flushPendingSave()
    setError("")
    setStatus("")

    try {
      const deleted = await Promise.all(folderPages.map(async (page) => {
        const response = await fetch(`/api/pages/${page.id}`, { method: "DELETE" })
        const data = await readJsonResponse(response)
        if (!response.ok) throw new Error(data.error || "Could not delete folder.")
        return { ...page, deletedAt: data.deletedAt }
      }))
      const deletedIds = new Set(deleted.map((page) => page.id))

      setDeletedPage(null)
      setTrashPages((current) => [...deleted, ...current.filter((page) => !deletedIds.has(page.id))])
      setPages((current) => {
        const next = current.filter((page) => !deletedIds.has(page.id))

        if (deletedIds.has(selectedId)) {
          const nextSelected = next[0]?.id || null
          setSelectedId(nextSelected)
          window.history.replaceState({}, "", nextSelected ? adminUrlForPage(next[0]) : adminHomeUrl(activeDomain, isPersonalWorkspace ? "personal" : "platform"))
        }

        return next
      })
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  async function undoDelete() {
    if (!deletedPage) return

    setError("")
    setStatus("Restoring")

    try {
      const response = await fetch(`/api/trash/${deletedPage.id}/restore`, {
        method: "POST",
      })
      const page = await readJsonResponse(response)

      if (!response.ok) throw new Error(page.error || "Could not restore route.")

      setPages((current) => [page, ...current.filter((entry) => entry.id !== page.id)]
        .sort(sortPagesNewestFirst))
      setTrashPages((current) => current.filter((entry) => entry.id !== page.id))
      setSelectedId(page.id)
      setDeletedPage(null)
      setStatus("Restored")
      window.setTimeout(() => setStatus(""), 1200)
    } catch (restoreError) {
      setError(restoreError.message)
      setStatus("")
    }
  }

  async function restoreFromTrash(pageToRestore) {
    setError("")

    try {
      const response = await fetch(`/api/trash/${pageToRestore.id}/restore`, { method: "POST" })
      const page = await readJsonResponse(response)

      if (!response.ok) throw new Error(page.error || "Could not restore route.")

      setPages((current) => [page, ...current.filter((entry) => entry.id !== page.id)].sort(sortPagesNewestFirst))
      setTrashPages((current) => current.filter((entry) => entry.id !== page.id))
      setDeletedPage((current) => current?.id === page.id ? null : current)
    } catch (restoreError) {
      setError(restoreError.message)
    }
  }

  async function permanentlyDeleteFromTrash(pageToDelete) {
    if (!window.confirm(`Permanently delete ${adminPathLabel(pageToDelete)}? This cannot be undone.`)) return

    setError("")

    try {
      const response = await fetch(`/api/trash/${pageToDelete.id}`, { method: "DELETE" })
      const data = await readJsonResponse(response)

      if (!response.ok) throw new Error(data.error || "Could not permanently delete route.")

      setTrashPages((current) => current.filter((entry) => entry.id !== pageToDelete.id))
      setDeletedPage((current) => current?.id === pageToDelete.id ? null : current)
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  function selectPage(page) {
    flushPendingSave()
    setIsSettingsMenuOpen(false)
    setIsCopyMenuOpen(false)
    setPathError("")
    setPermanentCopyStatus("")
    setSourceCopyStatus("")
    setSourcePasteStatus("")
    setSelectedId(page.id)
    setIsMobileSidebarOpen(false)
    window.history.pushState({}, "", adminUrlForPage(page))
  }

  function resetAdminHome() {
    flushPendingSave()
    setIsSettingsMenuOpen(false)
    setIsCopyMenuOpen(false)
    setQuery("")
    setError("")
    setStatus("")
    setCopyStatus("")
    setPermanentCopyStatus("")
    setSourceCopyStatus("")
    setSourcePasteStatus("")
    setHomeStatus("")
    setPathError("")
    setIsMobileSidebarOpen(false)
    keepAdminHomeUrl.current = true
    setSelectedId(pages[0]?.id || null)
    window.history.pushState({}, "", adminHomeUrl(activeDomain, isPersonalWorkspace ? "personal" : "platform"))
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
    setIsCopyMenuOpen(false)
    copyText(publicUrl(selectedPage), setCopyStatus)
  }

  function copyPermanentUrl() {
    if (!selectedPage) return
    setIsCopyMenuOpen(false)
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
      scheduleSave(withSuggestedTitle({ ...draft, source }, draft))
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
          title: draft.title,
          titleMode: draft.titleMode,
          status: "published",
          allowDuplicate: true,
          namespace: isPersonalWorkspace ? "user" : "platform",
          ownerId: isPersonalWorkspace ? account?.id : undefined,
        }),
      })
      const page = await readJsonResponse(response)

      if (!response.ok) throw new Error(page.error || "Could not duplicate route.")

      setPages((current) => [page, ...current].sort(sortPagesNewestFirst))
      setQuery("")
      setDeletedPage(null)
      focusPathAfterSelect.current = true
      setSelectedId(page.id)
      setIsMobileSidebarOpen(false)
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
        window.location.assign(publicUrl(selectedPage))
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
      } else if (key === "h") {
        event.preventDefault()
        saveDraft(draft, { isHome: !selectedPage.isHome })
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
    const folderNames = new Set(filteredPages.map(folderName).filter(Boolean))

    filteredPages.forEach((page) => {
      const folder = folderName(page)
      const rootFolder = !folder && folderNames.has(displayPath(page.path)) ? displayPath(page.path) : ""
      const targetFolder = folder || rootFolder

      if (!targetFolder) {
        entries.push({ type: "page", page, timestamp: pageTimestamp(page) })
        return
      }

      if (!folders.has(targetFolder)) folders.set(targetFolder, [])
      folders.get(targetFolder).push(page)
    })

    folders.forEach((folderPages, folder) => {
      folderPages.sort((a, b) => {
        const aIsRoot = displayPath(a.path) === folder
        const bIsRoot = displayPath(b.path) === folder

        if (aIsRoot !== bIsRoot) return aIsRoot ? -1 : 1
        return sortPagesNewestFirst(a, b)
      })
      entries.push({
        type: "folder",
        folder,
        pages: folderPages,
        timestamp: Math.max(...folderPages.map(pageTimestamp)),
      })
    })

    return entries.sort((a, b) => b.timestamp - a.timestamp)
  }, [filteredPages, query])

  function switchDomain(domain) {
    if (account?.role !== "owner") return
    if (workspaceMode === "platform" && domain === activeDomain) {
      setIsDomainMenuOpen(false)
      return
    }

    flushPendingSave()
    setWorkspaceMode("platform")
    setActiveDomain(domain)
    setPages([])
    setSelectedId(null)
    setIsMobileSidebarOpen(false)
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

  function switchToPersonalWorkspace() {
    if (!account?.username) {
      window.location.assign("/signup?choose=username")
      return
    }

    if (workspaceMode === "personal") {
      setIsDomainMenuOpen(false)
      return
    }

    flushPendingSave()
    setWorkspaceMode("personal")
    setActiveDomain(DEFAULT_DOMAIN)
    setPages([])
    setSelectedId(null)
    setIsMobileSidebarOpen(false)
    setDeletedPage(null)
    setQuery("")
    setIsDomainMenuOpen(false)
    setIsSettingsMenuOpen(false)
    window.history.pushState({}, "", adminHomeUrl(DEFAULT_DOMAIN, "personal"))
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.replace("/signup")
  }

  function changeSourceType(nextSourceType) {
    scheduleSave(withSuggestedTitle({ ...draft, sourceType: nextSourceType }, draft))
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

  async function savePageFaviconUrl(faviconUrl) {
    if (!selectedPage) return
    setError("")
    setFaviconStatus("Saving")

    try {
      const response = await fetch(`/api/pages/${selectedPage.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ faviconUrl: faviconUrl.trim() }),
      })
      const page = await readJsonResponse(response)
      if (!response.ok) throw new Error(page.error || "Could not save page icon.")

      setPages((current) => current.map((entry) => entry.id === page.id ? { ...entry, ...page } : entry))
      setPageFaviconUrlDraft(page.faviconUrl || "")
      setFaviconStatus("Saved")
      window.setTimeout(() => setFaviconStatus(""), 1200)
    } catch (faviconError) {
      setError(faviconError.message || "Could not update page icon.")
      setFaviconStatus("")
    }
  }

  async function uploadPageFavicon(event) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setError("")
    setFaviconStatus("Uploading")
    try {
      const form = new FormData()
      form.append("file", file)
      const response = await fetch("/api/media", { method: "POST", body: form })
      const upload = await readJsonResponse(response)
      if (!response.ok) throw new Error(upload.error || "Could not upload page icon.")
      await savePageFaviconUrl(upload.url)
    } catch (faviconError) {
      setError(faviconError.message || "Could not update page icon.")
      setFaviconStatus("")
    }
  }

  return (
    <div className={`admin-shell ${isMobileSidebarOpen ? "is-sidebar-open" : ""}`}>
      <button
        className="sidebar-scrim"
        type="button"
        onClick={() => setIsMobileSidebarOpen(false)}
        aria-label="Close pages"
      />
      <Sidebar
        account={account}
        activeDomain={activeDomain}
        collapsedFolders={collapsedFolders}
        domainMenuRef={domainMenuRef}
        faviconInputRef={faviconInputRef}
        filteredPages={filteredPages}
        isDomainMenuOpen={isDomainMenuOpen}
        isLoading={isLoading}
        isTrashLoading={isTrashLoading}
        isTrashOpen={isTrashOpen}
        onClearSearch={clearSearch}
        onCreatePage={createPage}
        onDeletePermanently={permanentlyDeleteFromTrash}
        onDeleteFolder={deleteFolder}
        onDeletePage={deleteRoute}
        onResetAdminHome={resetAdminHome}
        onRestorePage={restoreFromTrash}
        onSelectPage={selectPage}
        onSwitchDomain={switchDomain}
        onSwitchToPersonal={switchToPersonalWorkspace}
        onSignOut={signOut}
        onToggleDomainMenu={() => setIsDomainMenuOpen((current) => !current)}
        onToggleFolder={toggleFolder}
        onToggleTrash={() => {
          setIsTrashOpen((current) => !current)
          setIsMobileSidebarOpen(true)
        }}
        onUploadFavicon={uploadFavicon}
        query={query}
        searchInputRef={searchInputRef}
        selectedId={selectedId}
        workspaceMode={workspaceMode}
        setQuery={setQuery}
        sidebarEntries={sidebarEntries}
        trashPages={trashPages}
      />

      <main className="workspace">
        <header className="workspace-header">
          <EditorHeader
            activeDomain={activeDomain}
            copyMenuRef={copyMenuRef}
            copyStatus={copyStatus}
            domainSettings={domainSettings}
            draft={draft}
            editorView={editorView}
            error={error}
            faviconInputRef={faviconInputRef}
            faviconStatus={faviconStatus}
            faviconUrlDraft={faviconUrlDraft}
            isCopyMenuOpen={isCopyMenuOpen}
            isMobileSidebarOpen={isMobileSidebarOpen}
            isSettingsMenuOpen={isSettingsMenuOpen}
            isUserWorkspace={isUserWorkspace}
            onChangePath={(path) => scheduleSave(withSuggestedTitle(
              { ...draft, path },
              draft,
              { pathChanged: true }
            ))}
            onChangeTitle={(title) => scheduleSave({
              ...draft,
              title,
              titleMode: title.trim() ? "manual" : "auto",
            })}
            onChooseFavicon={() => {
              setIsSettingsMenuOpen(false)
              faviconInputRef.current?.click()
            }}
            onChoosePageFavicon={() => pageFaviconInputRef.current?.click()}
            onCloseDomainMenu={() => setIsDomainMenuOpen(false)}
            onCopyPermanentUrl={copyPermanentUrl}
            onCopyPublicUrl={copyPublicUrl}
            onResetPageFavicon={() => savePageFaviconUrl("")}
            onSaveFaviconUrl={saveFaviconUrl}
            onSavePageFaviconUrl={savePageFaviconUrl}
            onSetCopyMenuOpen={setIsCopyMenuOpen}
            onSetDomainMenuOpen={setIsDomainMenuOpen}
            onSetEditorView={setEditorView}
            onSetFaviconUrlDraft={setFaviconUrlDraft}
            onSetPageFaviconUrlDraft={setPageFaviconUrlDraft}
            onSetSettingsMenuOpen={setIsSettingsMenuOpen}
            onShowPages={() => setIsMobileSidebarOpen(true)}
            onUploadPageFavicon={uploadPageFavicon}
            pageFaviconInputRef={pageFaviconInputRef}
            pageFaviconUrlDraft={pageFaviconUrlDraft}
            pathError={pathError}
            pathInputRef={pathInputRef}
            permanentCopyStatus={permanentCopyStatus}
            selectedPage={selectedPage}
            settingsMenuRef={settingsMenuRef}
            status={status}
          />
        </header>
        {selectedPage ? (
          <EditorWorkspace
            draft={draft}
            editorView={editorView}
            homeStatus={homeStatus}
            onChangeSource={(source) => scheduleSave(withSuggestedTitle({ ...draft, source }, draft))}
            onChangeSourceType={changeSourceType}
            onCopySource={copySource}
            onDuplicateSource={duplicateSource}
            onPasteSource={pasteSource}
            onToggleHome={() => {
              saveDraft(draft, { isHome: !selectedPage.isHome })
            }}
            selectedPage={selectedPage}
            sourceCopyStatus={sourceCopyStatus}
            sourceMode={sourceMode}
            sourcePasteStatus={sourcePasteStatus}
            sourceTextareaRef={sourceTextareaRef}
            sourceType={sourceType}
          />
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
