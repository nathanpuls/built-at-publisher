export function SettingsMenu({
  activeDomain,
  domainSettings,
  faviconStatus,
  faviconUrlDraft,
  isOpen,
  menuRef,
  onChooseFavicon,
  onChoosePageFavicon,
  onCloseDomainMenu,
  onResetPageFavicon,
  onSaveFaviconUrl,
  onSavePageFaviconUrl,
  onSetFaviconUrlDraft,
  onSetPageFaviconUrlDraft,
  onToggle,
  page,
  pageFaviconInputRef,
  pageFaviconUrlDraft,
  onUploadPageFavicon,
}) {
  const sitePreview = domainSettings.faviconUrl || "/favicon-v2.svg"
  const pagePreview = page?.faviconUrl || sitePreview

  function IconPreview({ label, src }) {
    return (
      <div className="icon-preview-group">
        <span>{label}</span>
        <div>
          <span className="icon-preview"><img src={src} alt="" /></span>
          <span className="icon-preview is-maskable"><img src={src} alt="" /></span>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-control" ref={menuRef}>
      <button
        className="settings-trigger"
        type="button"
        onClick={() => {
          onCloseDomainMenu()
          onToggle()
        }}
        aria-label={`Settings for ${activeDomain}`}
        aria-expanded={isOpen}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
        </svg>
      </button>
      {isOpen ? (
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
          <section className="icon-settings-section">
            <strong>Site icon</strong>
            <IconPreview label="Regular / maskable" src={sitePreview} />
          </section>
          <button type="button" onClick={onChooseFavicon}>
            <span>Choose site icon</span>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <div className="favicon-url-control">
            <input
              value={faviconUrlDraft}
              onChange={(event) => onSetFaviconUrlDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSaveFaviconUrl(faviconUrlDraft)
              }}
              placeholder="Image URL"
              aria-label="Favicon image URL"
            />
            <button type="button" onClick={() => onSaveFaviconUrl(faviconUrlDraft)}>Apply</button>
          </div>
          {domainSettings.recentFavicons?.length ? (
            <div className="recent-favicons">
              <span>Recent</span>
              <div>
                {domainSettings.recentFavicons.map((favicon) => (
                  <button
                    className={favicon.faviconUrl === domainSettings.faviconUrl ? "is-current" : ""}
                    type="button"
                    onClick={() => onSaveFaviconUrl(favicon.faviconUrl)}
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
          {page ? (
            <section className="icon-settings-section page-icon-settings">
              <span className="icon-settings-title">
                <strong>Page icon</strong>
                <small>{page.faviconUrl ? "Page override" : "Using site default"}</small>
              </span>
              <IconPreview label="Regular / maskable" src={pagePreview} />
              <input ref={pageFaviconInputRef} className="visually-hidden" type="file" accept="image/*" onChange={onUploadPageFavicon} />
              <button type="button" onClick={onChoosePageFavicon}>
                <span>Choose page icon</span>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <div className="favicon-url-control">
                <input
                  value={pageFaviconUrlDraft}
                  onChange={(event) => onSetPageFaviconUrlDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onSavePageFaviconUrl(pageFaviconUrlDraft)
                  }}
                  placeholder="Page image URL"
                  aria-label="Page favicon image URL"
                />
                <button type="button" onClick={() => onSavePageFaviconUrl(pageFaviconUrlDraft)}>Apply</button>
              </div>
              {page.faviconUrl ? <button className="reset-page-icon" type="button" onClick={onResetPageFavicon}>Reset to site default</button> : null}
            </section>
          ) : null}
          {faviconStatus ? <span className="domain-settings-status">{faviconStatus}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
