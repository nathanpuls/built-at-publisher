# Clipboard Publisher

A small clipboard publisher. Paste HTML, Markdown, or plain text into the app or send it from iOS Shortcuts; the shared `/p/...` URL renders as a normal browser page.

## Local development

Use this for normal local testing. It applies local D1 migrations, starts the local Worker API on `8787`, and starts the Vite app on `5173`:

```sh
npm run dev:local
```

Then open `http://127.0.0.1:5173`.

That local URL supports:

- image uploads to local R2
- page publishing to local D1
- `/api/media`
- `/api/pages`
- Vite hot reload

For a production-like local Worker preview, build once and run Wrangler directly:

```sh
npm run build
npm run db:migrate:local
npm run dev:worker
```

Then open `http://localhost:8787`.

## Cloudflare setup

Image uploads use:

- R2 binding: `MEDIA_BUCKET`
- D1 binding: `DB`
- Public media base URL: `https://media.nathanpuls.com`
- Media uploads go directly into the `simple-editor` bucket without an extra folder prefix

Pages are stored in D1 using the existing `pages` table. The legacy `markdown` column now stores the rendered HTML document for compatibility with the current deployed database:

- Pages are namespaced by `domain + path`, so the same path can exist on
  `built.at` and `nathanpuls.com`.
- Page modes are Markdown, HTML, redirect, and full-page iframe.
- Page titles are edited independently from source content and become the
  rendered browser title.
- Each editable domain has its own uploaded favicon in `domain_settings`.
- `POST /api/pages` saves a draft page
- `GET /api/pages/:id` loads a page for editing
- `POST /api/publish` saves a published HTML page
- `POST /api/shortcut` publishes clipboard HTML, Markdown, or plain text from iOS Shortcuts and returns a share URL
- `GET /p/:id/:slug?` renders the saved HTML as a live page

## iOS Shortcut API

`POST /api/shortcut` accepts raw `text/plain` clipboard content or JSON. Raw text is auto-detected: HTML is published directly, while Markdown/plain text is converted into an HTML document. Every request creates a new editor post, even when its content matches an existing post. The response includes both `shareUrl` and `editorUrl`.

Opening `GET /api/shortcut?token=...` creates a blank draft and redirects directly into it in the admin editor. Optional `title`, `path`, `content`, `text`, `markdown`, and `html` query parameters can prefill the draft.

Use `"domain": "nathanpuls.com"` to create a NathanPuls.com path and
`"sourceType": "iframe"` with a URL in `content` to create an iframe-backed
page.

```json
{
  "content": "<!doctype html><html><body><h1>Hello</h1></body></html>",
  "title": "Optional title",
  "slug": "optional-slug"
}
```

For the previous API shape, `"markdown"` is still supported and is explicitly converted from Markdown to HTML.

Use one of these auth headers:

```txt
Authorization: Bearer YOUR_SHORTCUT_API_TOKEN
```

```txt
x-simple-editor-token: YOUR_SHORTCUT_API_TOKEN
```

The response includes `shareUrl`, which is the published page link to view or share, and `editorUrl`, which opens the new post in the editor.

Before deploying, update `wrangler.jsonc` with the real D1 database ID. Then run:

```sh
npm run db:migrate:remote
npm run deploy
```
