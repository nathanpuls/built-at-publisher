import { ArrowLeft, CaretRight, Check, Folder, LinkSimple, List, PencilSimple, Trash, X } from "@phosphor-icons/react"
import { detectSource } from "../lib/content"
import {
  EDITABLE_DOMAINS,
  PROJECT_ALL,
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
  if (!type) return <span className="kind" aria-hidden="true" />

  if (type === "redirect") {
    return (
      <span className="kind" data-tooltip="Link">
        <LinkSimple size={14} weight="bold" aria-hidden="true" />
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

    const meta = page.path
      ? [page.projectName, displayTitle(page)].filter(Boolean).join(" / ")
      : permanentPath(page)

    return (
      <div className={`item ${page.id === selectedId ? "is-active" : ""}`} data-id={page.id} key={page.id}>
        <button className="item-main" type="button" onClick={() => onSelect(page)}>
          <span className="path-row">
            <span className={`path ${page.path ? "" : "is-temporary"}`}>{adminPathLabel(page)}</span>
            {page.isHome ? <span className="home-pill">Home</span> : null}
          </span>
          <span className="meta">{meta}</span>
        </button>
        <TypeMark type={sourceType} />
        {page.namespace === "system" ? <span className="delete-route" aria-hidden="true" /> : (
          <button className="delete-route" type="button" data-tooltip="Delete path" aria-label={`Delete ${adminPathLabel(page)}`} onClick={() => onDelete(page)}>
            <Trash size={15} weight="bold" aria-hidden="true" />
          </button>
        )}
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
        <Trash size={15} weight="bold" aria-hidden="true" />
      </button>
    </div>
  ))
}

function ProjectMenuItem({ isActive, onRename, onSelect, project }) {
  return (
    <div className={`project-menu-row ${isActive ? "is-active" : ""}`}>
      <button className="project-menu-item" type="button" onClick={() => onSelect(project.slug)}>
        <span>{project.name}</span>
        {isActive ? <Check size={14} weight="bold" aria-hidden="true" /> : null}
      </button>
      <button className="project-rename-button" type="button" onClick={() => onRename(project)} aria-label={`Rename ${project.name}`}>
        <PencilSimple size={14} weight="bold" aria-hidden="true" />
      </button>
    </div>
  )
}

export function Sidebar({
  account,
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
  onCreateProject,
  onDeleteFolder,
  onDeletePermanently,
  onDeletePage,
  onResetAdminHome,
  onRestorePage,
  onRenameProject,
  onSelectPage,
  onSwitchDomain,
  onSwitchProject,
  onSwitchToPersonal,
  onSignOut,
  onToggleDomainMenu,
  onToggleFolder,
  onToggleTrash,
  onUploadFavicon,
  query,
  projects,
  searchInputRef,
  selectedId,
  activeProject,
  setQuery,
  sidebarEntries,
  trashPages,
  workspaceMode,
}) {
  const isUserWorkspace = Boolean(account && (account.role !== "owner" || workspaceMode === "personal"))
  const activeProjectRow = projects.find((project) => project.slug === activeProject)
  const workspaceLabel = isUserWorkspace
    ? activeProjectRow?.name || `@${account.username}`
    : activeDomain

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="domain-switcher" ref={domainMenuRef}>
          <button
            className="domain-menu-trigger"
            type="button"
            onClick={onToggleDomainMenu}
            aria-label="Switch workspace"
            aria-expanded={isDomainMenuOpen}
          >
            <List size={17} weight="bold" aria-hidden="true" />
          </button>
          <input ref={faviconInputRef} className="visually-hidden" type="file" accept="image/*" onChange={onUploadFavicon} />
          <button className={`routes-home ${isUserWorkspace ? "is-personal" : ""}`} type="button" onClick={onResetAdminHome} title={isUserWorkspace ? `built.at/${account.username}` : activeDomain}>
            {workspaceLabel}
          </button>
          {isDomainMenuOpen ? (
            <div className="domain-menu">
              {account?.role === "owner" ? (
                <>
                  <div className="account-menu-heading">
                    <strong>{account.displayName || account.username}</strong>
                    <small>{account.email}</small>
                  </div>
                  {EDITABLE_DOMAINS.map((domain) => (
                    <button
                      className={workspaceMode === "platform" && domain === activeDomain ? "is-active" : ""}
                      type="button"
                      onClick={() => onSwitchDomain(domain)}
                      key={domain}
                    >
                      <span>{domain}</span>
                      {workspaceMode === "platform" && domain === activeDomain ? <Check size={14} weight="bold" aria-hidden="true" /> : null}
                    </button>
                  ))}
                  <div className="domain-menu-section">
                    <span>{account.username ? `@${account.username}` : "Personal"}</span>
                    <button className={workspaceMode === "personal" && activeProject === PROJECT_ALL ? "is-active" : ""} type="button" onClick={onSwitchToPersonal}>
                      <span>All personal pages</span>
                      {workspaceMode === "personal" && activeProject === PROJECT_ALL ? <Check size={14} weight="bold" aria-hidden="true" /> : null}
                    </button>
                    {projects.map((project) => (
                      <ProjectMenuItem
                        isActive={workspaceMode === "personal" && activeProject === project.slug}
                        onRename={onRenameProject}
                        onSelect={onSwitchProject}
                        project={project}
                        key={project.id}
                      />
                    ))}
                    <button className="project-menu-item" type="button" onClick={onCreateProject}>
                      <span>Add project...</span>
                    </button>
                  </div>
                  {account.username ? <a href={`/${account.username}`} target="_blank" rel="noreferrer">View personal page</a> : null}
                  <button type="button" onClick={onSignOut}>Sign out</button>
                </>
              ) : isUserWorkspace ? (
                <>
                  <div className="account-menu-heading">
                    <strong>{account.displayName || account.username}</strong>
                    <small>{account.email}</small>
                  </div>
                  <div className="domain-menu-section">
                    <span>@{account.username}</span>
                    <button className={activeProject === PROJECT_ALL ? "is-active" : ""} type="button" onClick={() => onSwitchProject(PROJECT_ALL)}>
                      <span>All personal pages</span>
                      {activeProject === PROJECT_ALL ? <Check size={14} weight="bold" aria-hidden="true" /> : null}
                    </button>
                    {projects.map((project) => (
                      <ProjectMenuItem
                        isActive={activeProject === project.slug}
                        onRename={onRenameProject}
                        onSelect={onSwitchProject}
                        project={project}
                        key={project.id}
                      />
                    ))}
                    <button className="project-menu-item" type="button" onClick={onCreateProject}>
                      <span>Add project...</span>
                    </button>
                  </div>
                  <a href={`/${account.username}`} target="_blank" rel="noreferrer">View personal page</a>
                  <button type="button" onClick={onSignOut}>Sign out</button>
                </>
              ) : EDITABLE_DOMAINS.map((domain) => (
                <button
                  className={domain === activeDomain ? "is-active" : ""}
                  type="button"
                  onClick={() => onSwitchDomain(domain)}
                  key={domain}
                >
                  <span>{domain}</span>
                  {domain === activeDomain ? <Check size={14} weight="bold" aria-hidden="true" /> : null}
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
              <X size={16} weight="bold" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="items">
        {isTrashOpen ? (
          <>
            <div className="trash-heading">
              <div className="trash-heading-title">
                <button type="button" onClick={onToggleTrash} aria-label="Back to paths" data-tooltip="Back to paths (Esc)">
                  <ArrowLeft size={17} weight="bold" aria-hidden="true" />
                </button>
                <strong>Trash</strong>
              </div>
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
                <div className="folder-heading">
                  <button className="folder-label" type="button" onClick={() => onToggleFolder(entry.folder)} aria-expanded={!collapsedFolders.has(entry.folder)}>
                    <CaretRight className="folder-caret" size={14} weight="bold" aria-hidden="true" />
                    <Folder className="folder-icon" size={15} weight="bold" aria-hidden="true" />
                    <span>{entry.folder}</span>
                  </button>
                  {entry.pages.every((page) => page.namespace === "system") ? <span className="delete-folder" aria-hidden="true" /> : (
                    <button className="delete-folder" type="button" data-tooltip="Delete folder paths" aria-label={`Delete ${entry.folder} folder paths`} onClick={() => onDeleteFolder(entry.pages.filter((page) => page.namespace !== "system"))}>
                      <Trash size={15} weight="bold" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="folder-items">
                  <PageList pages={entry.pages} selectedId={selectedId} onSelect={onSelectPage} onDelete={onDeletePage} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      {!isTrashOpen ? (
        <button className="trash-toggle" type="button" onClick={onToggleTrash}>
          <Trash size={16} weight="bold" aria-hidden="true" />
          <span>Trash</span>
          {trashPages.length ? <span className="trash-count">{trashPages.length}</span> : null}
        </button>
      ) : null}
    </aside>
  )
}
