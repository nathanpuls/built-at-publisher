"use client"

import { useEffect, useRef, useState } from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
import { Markdown } from "@tiptap/markdown"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { TableKit } from "@tiptap/extension-table"
import { Selection } from "@tiptap/extensions"

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/tiptap-ui-primitive/dropdown-menu"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover"
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { CheckIcon } from "@/components/tiptap-icons/check-icon"
import { EllipsisIcon } from "@/components/tiptap-icons/ellipsis-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"
import { MoonStarIcon } from "@/components/tiptap-icons/moon-star-icon"
import { PencilIcon } from "@/components/tiptap-icons/pencil-icon"
import { SunIcon } from "@/components/tiptap-icons/sun-icon"

// --- Hooks ---
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"
import { useWindowSize } from "@/hooks/use-window-size"
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"

// --- Components ---
import {
  applyTheme,
  getInitialTheme,
  storeTheme,
} from "@/components/tiptap-templates/simple/theme-toggle"

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"

// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss"

import contentMarkdown from "@/components/tiptap-templates/simple/data/content.md?raw"

const LOCAL_DRAFT_KEY = "simple-editor:draft"
const LOCAL_MARKDOWN_KEY = "simple-editor:markdown"
const LOCAL_PAGE_ID_KEY = "simple-editor:page-id"
const LOCAL_CONTENT_VERSION_KEY = "simple-editor:content-version"
const WINDOW_DRAFT_KEY = "__simpleEditorDraft"
const CONTENT_VERSION = "anti-meeting-machine-v1"
const EMPTY_DOCUMENT = {
  type: "doc",
  content: [{ type: "paragraph" }],
}

function pageIdFromPath() {
  const match = window.location.pathname.match(/^\/p\/([A-Za-z0-9_-]+)(?:\/[^/]+)?$/)
  return match?.[1] || null
}

function isEditRoute() {
  return new URLSearchParams(window.location.search).get("edit") === "1"
}

function isPageRoute() {
  return Boolean(pageIdFromPath())
}

function readWindowDraft() {
  try {
    const saved = JSON.parse(window.name || "{}")
    return saved[WINDOW_DRAFT_KEY]?.json
      ? { content: saved[WINDOW_DRAFT_KEY].json, contentType: "json" }
      : null
  } catch {
    return null
  }
}

function writeWindowDraft(editor) {
  try {
    const saved = JSON.parse(window.name || "{}")

    saved[WINDOW_DRAFT_KEY] = {
      json: editor.getJSON(),
      markdown: editor.getMarkdown(),
    }

    window.name = JSON.stringify(saved)
  } catch {
    // Ignore preview-only storage failures.
  }
}

function readInitialContent() {
  if (pageIdFromPath()) {
    return { content: EMPTY_DOCUMENT, contentType: "json" }
  }

  try {
    const contentVersion = window.localStorage?.getItem(LOCAL_CONTENT_VERSION_KEY)
    const saved = window.localStorage?.getItem(LOCAL_DRAFT_KEY)

    if (contentVersion !== CONTENT_VERSION) {
      window.localStorage?.removeItem(LOCAL_DRAFT_KEY)
      window.localStorage?.removeItem(LOCAL_MARKDOWN_KEY)
      window.localStorage?.removeItem(LOCAL_PAGE_ID_KEY)
      return { content: contentMarkdown, contentType: "markdown" }
    }

    return saved
      ? { content: JSON.parse(saved), contentType: "json" }
      : readWindowDraft() || { content: contentMarkdown, contentType: "markdown" }
  } catch {
    return readWindowDraft() || { content: contentMarkdown, contentType: "markdown" }
  }
}

function writeLocalDraft(editor) {
  try {
    window.localStorage?.setItem(LOCAL_CONTENT_VERSION_KEY, CONTENT_VERSION)
    window.localStorage?.setItem(LOCAL_DRAFT_KEY, JSON.stringify(editor.getJSON()))
    window.localStorage?.setItem(LOCAL_MARKDOWN_KEY, editor.getMarkdown())
  } catch {
    // Some embedded previews disable localStorage. Regular browsers persist normally.
  }

  writeWindowDraft(editor)
}

function readLocalPageId() {
  const pathPageId = pageIdFromPath()

  if (pathPageId) {
    return pathPageId
  }

  try {
    const contentVersion = window.localStorage?.getItem(LOCAL_CONTENT_VERSION_KEY)

    if (contentVersion !== CONTENT_VERSION) {
      return null
    }

    return window.localStorage?.getItem(LOCAL_PAGE_ID_KEY) || null
  } catch {
    return null
  }
}

function writeLocalPageId(id) {
  try {
    window.localStorage?.setItem(LOCAL_PAGE_ID_KEY, id)
  } catch {
    // The API still returns the id; localStorage is only a convenience.
  }
}

function titleFromMarkdown(markdown) {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim()

  if (heading) {
    return heading.slice(0, 160)
  }

  const firstText = markdown
    .split("\n")
    .map((line) => line.trim().replace(/^#+\s*/, ""))
    .find(Boolean)

  return (firstText || "Untitled").slice(0, 160)
}

async function saveEditorPage(editor, pageId, status = "draft") {
  const markdown = editor.getMarkdown()
  const response = await fetch("/api/pages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      id: pageId,
      title: titleFromMarkdown(markdown),
      markdown,
      json: editor.getJSON(),
      status,
    }),
  })

  if (!response.ok) {
    throw new Error("Could not save page")
  }

  return response.json()
}

function syncPageUrl(page) {
  if (!page?.url) {
    return
  }

  const nextPath = page.url
  const nextUrl = `${nextPath}${window.location.search}${window.location.hash}`

  if (window.location.pathname !== nextPath) {
    window.history.replaceState({}, "", nextUrl)
  }
}

function editUrlForCurrentPage() {
  const url = new URL(window.location.href)
  url.searchParams.set("edit", "1")
  return `${url.pathname}${url.search}${url.hash}`
}

function readUrlForPage(page) {
  const path = page?.url || window.location.pathname
  return `${path}${window.location.hash}`
}

function looksLikeMarkdown(text) {
  const trimmed = text.trim()

  if (!trimmed) return false

  return (
    /^#{1,6}\s+\S/m.test(trimmed) ||
    /^>\s+\S/m.test(trimmed) ||
    /^[-*+]\s+\S/m.test(trimmed) ||
    /^\d+\.\s+\S/m.test(trimmed) ||
    /^```/m.test(trimmed) ||
    /^-{3,}$/m.test(trimmed) ||
    /^\|.+\|\s*$/m.test(trimmed) ||
    /\[[^\]]+\]\([^)]+\)/.test(trimmed) ||
    /(^|[^*])\*\*[^*]+\*\*/.test(trimmed) ||
    /(^|[^_])__[^_]+__/.test(trimmed) ||
    /`[^`]+`/.test(trimmed)
  )
}

function looksLikeHtml(text) {
  const trimmed = text.trim()

  if (!trimmed) return false

  return /<\/?[a-z][\s\S]*>/i.test(trimmed)
}

function cleanPastedHtml(html) {
  const template = document.createElement("template")
  template.innerHTML = html

  template.content
    .querySelectorAll("script, style, iframe, object, embed, link, meta, base")
    .forEach((element) => element.remove())

  template.content.querySelectorAll("*").forEach((element) => {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim().toLowerCase()

      if (
        name.startsWith("on") ||
        name === "srcdoc" ||
        ((name === "href" || name === "src") && value.startsWith("javascript:"))
      ) {
        element.removeAttribute(attribute.name)
      }
    }
  })

  return template.innerHTML
}

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile
}) => {
  return (
    <>
      <Spacer />
      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        <HeadingDropdownMenu modal={false} levels={[1, 2, 3, 4]} />
        <ListDropdownMenu modal={false} types={["bulletList", "orderedList", "taskList"]} />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
        <MarkButton type="strike" />
        <MarkButton type="underline" />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
      </ToolbarGroup>
      <ToolbarSeparator />
      {!isMobile && (
        <>
          <ToolbarGroup>
            <MarkButton type="code" />
            <MarkButton type="superscript" />
            <MarkButton type="subscript" />
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            <TextAlignButton align="left" />
            <TextAlignButton align="center" />
            <TextAlignButton align="right" />
            <TextAlignButton align="justify" />
          </ToolbarGroup>
          <ToolbarSeparator />
        </>
      )}
      <ToolbarGroup>
        <ImageUploadButton text="Add" />
      </ToolbarGroup>
      <Spacer />
      <Spacer size={isMobile ? "0.25rem" : "9rem"} />
    </>
  );
}

const MobileToolbarContent = ({
  type,
  onBack
}) => (
  <>
    <ToolbarGroup>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
)

function PageActionsMenu({
  isEditing,
  theme,
  onEdit,
  onToggleTheme,
}) {
  const isDarkMode = theme === "dark"

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="simple-editor-action simple-editor-menu-action"
          tooltip="Actions"
          aria-label="Actions">
          <EllipsisIcon className="tiptap-button-icon" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="simple-editor-actions-menu">
        <DropdownMenuGroup>
          {!isEditing && (
            <DropdownMenuItem className="simple-editor-actions-menu-item" onSelect={onEdit}>
              <PencilIcon className="tiptap-button-icon" />
              <span>Edit</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="simple-editor-actions-menu-item" onSelect={onToggleTheme}>
            {isDarkMode ? (
              <SunIcon className="tiptap-button-icon" />
            ) : (
              <MoonStarIcon className="tiptap-button-icon" />
            )}
            <span>{isDarkMode ? "Light mode" : "Dark mode"}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SimpleEditor() {
  const isMobile = useIsBreakpoint()
  const { height } = useWindowSize()
  const [isEditing, setIsEditing] = useState(() => !isPageRoute() || isEditRoute())
  const [isPublishing, setIsPublishing] = useState(false)
  const [mobileView, setMobileView] = useState("main")
  const [theme, setTheme] = useState(getInitialTheme)
  const [isPageLoading, setIsPageLoading] = useState(() => Boolean(pageIdFromPath()))
  const toolbarRef = useRef(null)
  const initialContentRef = useRef(readInitialContent())
  const pageIdRef = useRef(readLocalPageId())
  const saveTimerRef = useRef(null)
  const pendingLoadRef = useRef(true)

  const editor = useEditor({
    immediatelyRender: false,
    editable: isEditing,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
      handlePaste: (_view, event) => {
        if (!isEditing) {
          return false
        }

        const clipboardData = event.clipboardData
        const html = clipboardData?.getData("text/html") || ""
        const text = clipboardData?.getData("text/plain") || ""

        if (html || looksLikeHtml(text)) {
          event.preventDefault()
          editor?.commands.insertContent(cleanPastedHtml(html || text))
          return true
        }

        if (!looksLikeMarkdown(text)) {
          return false
        }

        event.preventDefault()
        editor?.commands.insertContent(text, { contentType: "markdown" })
        return true
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: !isEditing,
          enableClickSelection: true,
        },
      }),
      Markdown.configure({
        markedOptions: {
          gfm: true,
          breaks: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({
        table: {
          renderWrapper: true,
        },
      }),
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
    ],
    content: initialContentRef.current.content,
    contentType: initialContentRef.current.contentType,
    onUpdate: ({ editor }) => {
      if (!isEditing) {
        return
      }

      writeLocalDraft(editor)

      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(async () => {
        try {
          const page = await saveEditorPage(editor, pageIdRef.current)
          pageIdRef.current = page.id
          writeLocalPageId(page.id)
          syncPageUrl(page)
        } catch (error) {
          console.warn(error)
        }
      }, 900)
    },
  })

  const publishPage = async () => {
    if (!editor || isPublishing) {
      return
    }

    setIsPublishing(true)

    try {
      const page = await saveEditorPage(editor, pageIdRef.current, "published")
      pageIdRef.current = page.id
      writeLocalPageId(page.id)
      writeLocalDraft(editor)
      setIsEditing(false)
      editor.setEditable(false)
      window.history.replaceState({}, "", readUrlForPage(page))
    } catch (error) {
      console.warn(error)
    } finally {
      setIsPublishing(false)
    }
  }

  const startEditing = () => {
    if (!editor) {
      return
    }

    setIsEditing(true)
    editor.setEditable(true)
    window.history.replaceState({}, "", editUrlForCurrentPage())
    editor.commands.focus()
  }

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark"
      storeTheme(nextTheme)
      applyTheme(nextTheme)
      return nextTheme
    })
  }

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  })

  useEffect(() => {
    if (!isMobile && mobileView !== "main") {
      setMobileView("main")
    }
  }, [isMobile, mobileView])

  useEffect(() => {
    return () => window.clearTimeout(saveTimerRef.current)
  }, [])

  useEffect(() => {
    editor?.setEditable(isEditing)
  }, [editor, isEditing])

  useEffect(() => {
    if (!editor || !pendingLoadRef.current) {
      return
    }

    pendingLoadRef.current = false

    if (!pageIdRef.current) {
      setIsPageLoading(false)
      return
    }

    let ignore = false

    async function loadSavedPage() {
      try {
        const response = await fetch(`/api/pages/${pageIdRef.current}`)

        if (!response.ok) {
          if (!ignore) {
            setIsPageLoading(false)
          }
          return
        }

        const page = await response.json()

        if (!ignore && page.json) {
          editor.commands.setContent(page.json, { emitUpdate: false })
          pageIdRef.current = page.id
          writeLocalPageId(page.id)
          writeLocalDraft(editor)
        }
      } catch (error) {
        console.warn(error)
      } finally {
        if (!ignore) {
          setIsPageLoading(false)
        }
      }
    }

    loadSavedPage()

    return () => {
      ignore = true
    }
  }, [editor])

  const handleReadModeClick = (event) => {
    if (isEditing) {
      return
    }

    const link = event.target.closest?.("a[href]")

    if (!link) {
      return
    }

    event.preventDefault()
    const href = link.getAttribute("href")

    if (!href) {
      return
    }

    const nextUrl = new URL(href, window.location.href)

    if (link.target === "_blank") {
      window.open(nextUrl.href, "_blank", "noopener,noreferrer")
      return
    }

    window.location.href = nextUrl.href
  }

  return (
    <div
      className={`simple-editor-wrapper ${isEditing ? "is-editing" : "is-reading"} ${isPageLoading ? "is-loading" : "is-loaded"}`}
      onClick={handleReadModeClick}>
      <div className="simple-editor-page-actions">
        <PageActionsMenu
          isEditing={isEditing}
          theme={theme}
          onEdit={startEditing}
          onToggleTheme={toggleTheme} />
        <div className="simple-editor-primary-action">
          {isEditing && (
            <Button
              type="button"
              variant="ghost"
              className="simple-editor-action simple-editor-publish-action"
              tooltip={isPublishing ? "Publishing" : "Publish"}
              disabled={!editor || isPublishing}
              onClick={publishPage}>
              <CheckIcon className="tiptap-button-icon" />
              <span>Publish</span>
            </Button>
          )}
        </div>
      </div>
      <EditorContext.Provider value={{ editor }}>
        {isEditing && (
          <Toolbar
            ref={toolbarRef}
            style={{
              ...(isMobile
                ? {
                    bottom: `calc(100% - ${height - rect.y}px)`,
                  }
                : {}),
            }}>
            {mobileView === "main" ? (
              <MainToolbarContent
                onHighlighterClick={() => setMobileView("highlighter")}
                onLinkClick={() => setMobileView("link")}
                isMobile={isMobile} />
            ) : (
              <MobileToolbarContent
                type={mobileView === "highlighter" ? "highlighter" : "link"}
                onBack={() => setMobileView("main")} />
            )}
          </Toolbar>
        )}

        {!isPageLoading && (
          <EditorContent editor={editor} role="presentation" className="simple-editor-content" />
        )}
      </EditorContext.Provider>
    </div>
  );
}
