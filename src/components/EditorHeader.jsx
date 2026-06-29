import { CaretDown, Check, List } from "@phosphor-icons/react"
import { SettingsMenu } from "./SettingsMenu"
import { displayPath, publicUrl } from "../lib/pages"

export function EditorHeader({
  activeDomain,
  copyMenuRef,
  copyStatus,
  domainSettings,
  draft,
  error,
  faviconInputRef,
  faviconStatus,
  faviconUrlDraft,
  isCopyMenuOpen,
  isMobileSidebarOpen,
  isSettingsMenuOpen,
  isUserWorkspace,
  onChangePath,
  onChangeTitle,
  onChooseFavicon,
  onChoosePageFavicon,
  onCloseDomainMenu,
  onCopyPermanentUrl,
  onCopyPublicUrl,
  onResetPageFavicon,
  onSaveFaviconUrl,
  onSavePageFaviconUrl,
  onSetCopyMenuOpen,
  onSetDomainMenuOpen,
  onSetFaviconUrlDraft,
  onSetPageFaviconUrlDraft,
  onSetSettingsMenuOpen,
  onShowPages,
  onUploadPageFavicon,
  pageFaviconInputRef,
  pageFaviconUrlDraft,
  pathError,
  pathInputRef,
  permanentCopyStatus,
  selectedPage,
  settingsMenuRef,
  status,
  editorView,
  onSetEditorView,
}) {
  if (!selectedPage) return null

  return (
    <>
      <button
        className="mobile-sidebar-toggle"
        type="button"
        onClick={onShowPages}
        aria-label="Show pages"
        aria-expanded={isMobileSidebarOpen}
      >
        <List size={21} weight="bold" aria-hidden="true" />
        <span>{displayPath(selectedPage.path) || "Untitled"}</span>
      </button>
      <div className="header-path-field">
        <span className="header-path-input">
          <span className="header-path-label">Path</span>
          <input
            ref={pathInputRef}
            value={draft.path}
            aria-label="Path"
            readOnly={selectedPage.namespace === "system"}
            aria-invalid={Boolean(pathError)}
            aria-describedby={pathError ? "path-error" : undefined}
            aria-keyshortcuts="p"
            onChange={(event) => onChangePath(event.target.value)}
          />
          {pathError ? <span className="field-error" id="path-error">{pathError}</span> : null}
        </span>
        <span className="header-title-input">
          <span className="header-path-label">Title</span>
          <input
            value={draft.title}
            aria-label="Page title"
            onChange={(event) => onChangeTitle(event.target.value)}
          />
        </span>
      </div>
      <div className="path-actions">
        <div className="editor-view-switcher" role="group" aria-label="Editor view">
          <button className={editorView === "source" ? "is-active" : ""} type="button" onClick={() => onSetEditorView("source")} aria-pressed={editorView === "source"}>Source</button>
          <button className={editorView === "split" ? "is-active" : ""} type="button" onClick={() => onSetEditorView("split")} aria-pressed={editorView === "split"}>Split</button>
          <button className={editorView === "preview" ? "is-active" : ""} type="button" onClick={() => onSetEditorView("preview")} aria-pressed={editorView === "preview"}>Preview</button>
        </div>
        <SettingsMenu
          activeDomain={activeDomain}
          canManageSite={!isUserWorkspace}
          domainSettings={domainSettings}
          faviconStatus={faviconStatus}
          faviconUrlDraft={faviconUrlDraft}
          isOpen={isSettingsMenuOpen}
          menuRef={settingsMenuRef}
          onChooseFavicon={onChooseFavicon}
          onChoosePageFavicon={onChoosePageFavicon}
          onCloseDomainMenu={onCloseDomainMenu}
          onResetPageFavicon={onResetPageFavicon}
          onSaveFaviconUrl={onSaveFaviconUrl}
          onSavePageFaviconUrl={onSavePageFaviconUrl}
          onSetFaviconUrlDraft={onSetFaviconUrlDraft}
          onSetPageFaviconUrlDraft={onSetPageFaviconUrlDraft}
          onToggle={() => {
            onSetCopyMenuOpen(false)
            onSetSettingsMenuOpen((current) => !current)
          }}
          onUploadPageFavicon={onUploadPageFavicon}
          page={selectedPage}
          pageFaviconInputRef={pageFaviconInputRef}
          pageFaviconUrlDraft={pageFaviconUrlDraft}
        />
        <div className="copy-url-control" ref={copyMenuRef}>
          <button className={`button copy-action ${copyStatus || permanentCopyStatus ? "is-copied" : ""}`} type="button" onClick={onCopyPublicUrl} aria-keyshortcuts="u">
            {copyStatus || permanentCopyStatus ? "Copied" : "Copy URL"}
          </button>
          <button
            className="copy-menu-trigger"
            type="button"
            onClick={() => {
              onSetDomainMenuOpen(false)
              onSetSettingsMenuOpen(false)
              onSetCopyMenuOpen((current) => !current)
            }}
            aria-label="More copy options"
            aria-expanded={isCopyMenuOpen}
          >
            <CaretDown size={16} weight="bold" aria-hidden="true" />
          </button>
          {isCopyMenuOpen ? (
            <div className="copy-url-menu">
              <button type="button" onClick={onCopyPublicUrl}>
                <span>Copy public URL</span>
                {copyStatus ? (
                  <Check size={16} weight="bold" aria-hidden="true" />
                ) : null}
              </button>
              <button type="button" onClick={onCopyPermanentUrl}>
                <span>Copy permanent link</span>
                {permanentCopyStatus ? (
                  <Check size={16} weight="bold" aria-hidden="true" />
                ) : null}
              </button>
            </div>
          ) : null}
        </div>
        <a className="button open-action" href={publicUrl(selectedPage)} aria-keyshortcuts="o">Open</a>
        <span className={`action-status ${error ? "is-error" : ""}`}>{error || status}</span>
      </div>
    </>
  )
}
