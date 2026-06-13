import { detectSource } from "../lib/content"
import {
  EDITABLE_DOMAINS,
  adminPathLabel,
  displayTitle,
  permanentPath,
} from "../lib/pages"

function typeLabel(type) {
  if (type === "redirect") return "Link"
  if (type === "iframe") return "Iframe"
  if (type === "html") return "HTML"
  return "Markdown"
}

function TypeMark({ type }) {
  if (!type) return null

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

  return <span className="kind" data-tooltip={typeLabel(type)}>{type === "html" ? "</>" : type === "iframe" ? "IF" : "MD"}</span>
}

function PageList({ pages, selectedId, onSelect, onDelete }) {
  return pages.map((page) => {
    const source = String(page.source || "")
    const sourceType = page.sourceType === "auto"
      ? (source.trim() ? detectSource(source) : "")
      : (page.sourceType || (source.trim() ? detectSource(source) : ""))

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

function daysRemaining(deletedAt) {
  const expiresAt = Date.parse(deletedAt || "") + (30 * 24 * 60 * 60 * 1000)
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)))
}

function TrashList({ pages, onDeletePermanently, onRestore }) {
  if (!pages.length) {
    return <p className="empty-state">Trash is empty</p>
  }

  return pages.map((page) => (
    <div className="trash-item" key={page.id}>
      <span className="trash-item-copy">
        <strong>{adminPathLabel(page)}</strong>
        <small>{daysRemaining(page.deletedAt)} days remaining</small>
      </span>
      <button type="button" onClick={() => onRestore(page)}>Restore</button>
      <button className="trash-delete" type="button" onClick={() => onDeletePermanently(page)} aria-label={`Permanently delete ${adminPathLabel(page)}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v5" />
          <path d="M14 11v5" />
        </svg>
      </button>
    </div>
  ))
}

export function Sidebar({
  activeDomain,
  collapsedFolders,
  domainMenuRef,
  faviconInputRef,
  filteredPages,
  isDomainMenuOpen,
  isLoading,
  isTrashLoading,
  isTrashOpen,
  onClearSearch,
  onCreatePage,
  onDeletePermanently,
  onDeletePage,
  onResetAdminHome,
  onRestorePage,
  onSelectPage,
  onSwitchDomain,
  onToggleDomainMenu,
  onToggleFolder,
  onToggleTrash,
  onUploadFavicon,
  query,
  searchInputRef,
  selectedId,
  setQuery,
  sidebarEntries,
  trashPages,
}) {
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="domain-switcher" ref={domainMenuRef}>
          <button
            className="domain-menu-trigger"
            type="button"
            onClick={onToggleDomainMenu}
            aria-label="Switch domain"
            aria-expanded={isDomainMenuOpen}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <input ref={faviconInputRef} className="visually-hidden" type="file" accept="image/*" onChange={onUploadFavicon} />
          <button className="routes-home" type="button" onClick={onResetAdminHome}>
            {activeDomain}
          </button>
          {isDomainMenuOpen ? (
            <div className="domain-menu">
              {EDITABLE_DOMAINS.map((domain) => (
                <button
                  className={domain === activeDomain ? "is-active" : ""}
                  type="button"
                  onClick={() => onSwitchDomain(domain)}
                  key={domain}
                >
                  <span>{domain}</span>
                  {domain === activeDomain ? <span aria-hidden="true">✓</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button className="primary" type="button" onClick={onCreatePage} aria-label="New path" aria-keyshortcuts="n">New</button>
      </header>

      <div className={`search-row ${isTrashOpen ? "is-hidden" : ""}`}>
        <div className="search-control">
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault()
                onClearSearch()
              }
            }}
            placeholder="Search paths and content"
            aria-keyshortcuts="/ Escape"
          />
          {query ? (
            <button className="clear-search" type="button" onClick={onClearSearch} aria-label="Clear search" title="Clear search">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="m7 7 10 10M17 7 7 17" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="items">
        {isTrashOpen ? (
          <>
            <div className="trash-heading">
              <strong>Trash</strong>
              <span>Deleted after 30 days</span>
            </div>
            {isTrashLoading ? <p className="empty-state">Loading trash</p> : <TrashList pages={trashPages} onRestore={onRestorePage} onDeletePermanently={onDeletePermanently} />}
          </>
        ) : (
          <>
            {isLoading ? <p className="empty-state">Loading paths</p> : null}
            {!isLoading && filteredPages.length === 0 ? <p className="empty-state">No paths found</p> : null}
            {sidebarEntries.map((entry) => entry.type === "page" ? (
              <PageList pages={[entry.page]} selectedId={selectedId} onSelect={onSelectPage} onDelete={onDeletePage} key={entry.page.id} />
            ) : (
              <div className={`folder-group ${collapsedFolders.has(entry.folder) ? "is-collapsed" : ""}`} key={entry.folder}>
                <button className="folder-label" type="button" onClick={() => onToggleFolder(entry.folder)} aria-expanded={!collapsedFolders.has(entry.folder)}>
                  <span className="folder-caret" aria-hidden="true">›</span>
                  <span>{entry.folder}</span>
                </button>
                <div className="folder-items">
                  <PageList pages={entry.pages} selectedId={selectedId} onSelect={onSelectPage} onDelete={onDeletePage} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <button className={`trash-toggle ${isTrashOpen ? "is-active" : ""}`} type="button" onClick={onToggleTrash}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
        </svg>
        <span>{isTrashOpen ? "Back to paths" : "Trash"}</span>
        {!isTrashOpen && trashPages.length ? <span className="trash-count">{trashPages.length}</span> : null}
      </button>
    </aside>
  )
}
