const DEFAULT_MEDIA_PREFIX = ""
const DEFAULT_PUBLIC_MEDIA_BASE_URL = "https://media.nathanpuls.com"

function safeFilename(name) {
  const fallback = "image"
  const cleaned = (name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return cleaned || fallback
}

function extensionFromFilename(name) {
  const match = safeFilename(name).match(/\.([a-z0-9]+)$/)
  return match?.[1] ? `.${match[1]}` : ""
}

export function createMediaHandlers({ isLocalRequest, json }) {
  function mediaUrl(request, env, key) {
    if (env.USE_PUBLIC_MEDIA_URLS === "true" && !isLocalRequest(request)) {
      const baseUrl = env.PUBLIC_MEDIA_BASE_URL || DEFAULT_PUBLIC_MEDIA_BASE_URL
      return `${baseUrl.replace(/\/$/, "")}/${key}`
    }

    return `/api/media/file/${key}`
  }

  async function uploadMedia(request, env) {
    if (!env.MEDIA_BUCKET) {
      return json({ error: "MEDIA_BUCKET binding is not configured." }, { status: 500 })
    }

    if (!env.DB) {
      return json({ error: "DB binding is not configured." }, { status: 500 })
    }

    const form = await request.formData()
    const file = form.get("file")

    if (!(file instanceof File)) {
      return json({ error: "Expected multipart form data with a file field." }, { status: 400 })
    }

    if (!file.type.startsWith("image/")) {
      return json({ error: "Only image uploads are allowed." }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const prefix = env.MEDIA_PREFIX ?? DEFAULT_MEDIA_PREFIX
    const originalName = file.name || "image"
    const extension = extensionFromFilename(originalName)
    const cleanedPrefix = prefix.replace(/^\/|\/$/g, "")
    const key = cleanedPrefix ? `${cleanedPrefix}/${id}${extension}` : `${id}${extension}`
    const now = new Date().toISOString()

    await env.MEDIA_BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        originalName,
        uploadedAt: now,
      },
    })

    const url = mediaUrl(request, env, key)

    await env.DB.prepare(
      `INSERT INTO media_files
        (id, key, url, original_name, content_type, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, key, url, originalName, file.type, file.size, now)
      .run()

    return json({
      id,
      key,
      url,
      originalName,
      contentType: file.type,
      size: file.size,
      createdAt: now,
    })
  }

  async function listMedia(env) {
    if (!env.DB) {
      return json({ error: "DB binding is not configured." }, { status: 500 })
    }

    const result = await env.DB.prepare(
      `SELECT id, key, url, original_name AS originalName,
        content_type AS contentType, size, created_at AS createdAt
       FROM media_files
       ORDER BY created_at DESC
       LIMIT 100`
    ).all()

    return json({ files: result.results || [] })
  }

  async function getMediaObject(request, env) {
    if (!env.MEDIA_BUCKET) {
      return json({ error: "MEDIA_BUCKET binding is not configured." }, { status: 500 })
    }

    const { pathname } = new URL(request.url)
    const key = decodeURIComponent(pathname.replace(/^\/api\/media\/file\//, ""))
    const object = await env.MEDIA_BUCKET.get(key)

    if (!object) {
      return new Response("Not found", { status: 404 })
    }

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set("etag", object.httpEtag)

    return new Response(request.method === "HEAD" ? null : object.body, { headers })
  }

  return {
    getMediaObject,
    listMedia,
    uploadMedia,
  }
}
