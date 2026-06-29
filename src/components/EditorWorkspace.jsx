import { Check, Clipboard, Copy, CopySimple, HouseSimple } from "@phosphor-icons/react"
import { previewDocument, redirectUrl, renderSource } from "../lib/content"
import { publicUrl } from "../lib/pages"

export function EditorWorkspace({
  draft,
  editorView,
  homeStatus,
  onChangeSource,
  onChangeSourceType,
  onCopySource,
  onDuplicateSource,
  onPasteSource,
  onToggleHome,
  selectedPage,
  sourceCopyStatus,
  sourceMode,
  sourcePasteStatus,
  sourceTextareaRef,
  sourceType,
}) {
  if (!selectedPage) return null

  return (
    <div className="editor">
      <div className={`form-grid is-${editorView}-view`}>
        <div className="source-area">
          <div className="field-label source-label">
            <span className="source-heading">
              <span>Source</span>
              <select value={sourceMode === "auto" ? sourceType : sourceMode} onChange={(event) => onChangeSourceType(event.target.value)} aria-label="Page mode">
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
                onClick={onCopySource}
                data-tooltip="Copy source (C)"
                aria-label={sourceCopyStatus ? "Source copied" : "Copy source"}
                aria-keyshortcuts="c"
              >
                {sourceCopyStatus ? (
                  <Check size={17} weight="bold" aria-hidden="true" />
                ) : (
                  <Copy size={17} weight="bold" aria-hidden="true" />
                )}
              </button>
              <button
                className={`source-tool-action ${sourcePasteStatus ? "is-success" : ""}`}
                type="button"
                onClick={onPasteSource}
                data-tooltip={sourcePasteStatus ? "Source pasted" : "Paste source (V)"}
                aria-label={sourcePasteStatus ? "Source pasted" : "Paste source"}
                aria-keyshortcuts="v"
              >
                {sourcePasteStatus ? (
                  <Check size={17} weight="bold" aria-hidden="true" />
                ) : (
                  <Clipboard size={17} weight="bold" aria-hidden="true" />
                )}
              </button>
              <button
                className="source-tool-action"
                type="button"
                onClick={onDuplicateSource}
                data-tooltip="Duplicate into new page (D)"
                aria-label="Duplicate source into a new page"
                aria-keyshortcuts="d"
              >
                <CopySimple size={17} weight="bold" aria-hidden="true" />
              </button>
              <button
                className={`source-tool-action home-tool-action ${selectedPage.isHome || homeStatus === "set" ? "is-home" : ""}`}
                type="button"
                onClick={onToggleHome}
                data-tooltip={selectedPage.isHome ? "Unset home (H)" : "Set as home (H)"}
                aria-label={selectedPage.isHome ? "Unset home" : "Set as home"}
                aria-keyshortcuts="h"
                aria-pressed={selectedPage.isHome}
              >
                <HouseSimple size={17} weight="bold" aria-hidden="true" />
              </button>
            </span>
          </div>
          <div className="source-field">
            <textarea
              ref={sourceTextareaRef}
              value={draft.source}
              onChange={(event) => onChangeSource(event.target.value)}
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
              key={`html-preview-${selectedPage.id}`}
              className="html-preview"
              title="HTML preview"
              sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
              srcDoc={previewDocument(draft.source, publicUrl(selectedPage))}
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
  )
}
