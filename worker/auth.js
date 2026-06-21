const SESSION_COOKIE = "built_session"
const OAUTH_STATE_COOKIE = "built_oauth_state"
const OAUTH_VERIFIER_COOKIE = "built_oauth_verifier"
const SESSION_DAYS = 30
const RESERVED_USERNAMES = new Set(["admin", "api", "assets", "p", "signup"])

function base64Url(bytes) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function randomToken(length = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(length)))
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return base64Url(new Uint8Array(digest))
}

function cookieValue(request, name) {
  const cookie = request.headers.get("cookie") || ""
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ""
}

function cookie(name, value, { maxAge, request, httpOnly = true } = {}) {
  const secure = new URL(request.url).protocol === "https:"
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    httpOnly ? "HttpOnly" : "",
    secure ? "Secure" : "",
    Number.isFinite(maxAge) ? `Max-Age=${Math.max(0, Math.floor(maxAge))}` : "",
  ].filter(Boolean).join("; ")
}

function redirect(url, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: {
      location: url,
      "cache-control": "no-store",
      ...headers,
    },
  })
}

function normalizeUsername(value) {
  const username = String(value || "").trim().toLowerCase()
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/.test(username)) return ""
  return RESERVED_USERNAMES.has(username) ? "" : username
}

function authConfigured(env) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
}

function publicUser(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email || "",
    displayName: row.display_name || "",
    username: row.username || "",
    role: row.role || "user",
  }
}

export function createAuthHandlers({ editorOrigin, json, makeId }) {
  async function currentUser(request, env) {
    if (!env.DB) return null
    const token = cookieValue(request, SESSION_COOKIE)
    if (!token) return null

    const idHash = await sha256(token)
    const row = await env.DB.prepare(
      `SELECT users.*, sessions.expires_at
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id_hash = ? AND datetime(sessions.expires_at) > datetime('now')
       LIMIT 1`
    ).bind(idHash).first()

    if (!row) return null

    const now = new Date().toISOString()
    env.DB.prepare("UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?")
      .bind(now, idHash)
      .run()
      .catch(() => {})

    return row
  }

  async function authStatus(request, env) {
    const user = await currentUser(request, env)
    return json({
      configured: authConfigured(env),
      user: publicUser(user),
      needsUsername: Boolean(user && !user.username && user.role !== "owner"),
    })
  }

  async function beginGoogleAuth(request, env) {
    if (!authConfigured(env)) {
      return redirect(new URL("/signup?error=google-not-configured", editorOrigin).href)
    }

    const state = randomToken()
    const verifier = randomToken(48)
    const challenge = await sha256(verifier)
    const requestUrl = new URL(request.url)
    const redirectUri = env.GOOGLE_REDIRECT_URI || `${requestUrl.origin}/api/auth/callback`
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")

    authUrl.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString()

    const headers = new Headers({ location: authUrl.href, "cache-control": "no-store" })
    headers.append("set-cookie", cookie(OAUTH_STATE_COOKIE, state, { maxAge: 600, request }))
    headers.append("set-cookie", cookie(OAUTH_VERIFIER_COOKIE, verifier, { maxAge: 600, request }))
    return new Response(null, { status: 302, headers })
  }

  async function finishGoogleAuth(request, env) {
    const url = new URL(request.url)
    const state = url.searchParams.get("state") || ""
    const code = url.searchParams.get("code") || ""
    const expectedState = cookieValue(request, OAUTH_STATE_COOKIE)
    const verifier = cookieValue(request, OAUTH_VERIFIER_COOKIE)

    if (!code || !state || !expectedState || state !== expectedState || !verifier) {
      return redirect(new URL("/signup?error=invalid-oauth-state", editorOrigin).href)
    }

    const redirectUri = env.GOOGLE_REDIRECT_URI || `${url.origin}/api/auth/callback`
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    })
    const tokens = await tokenResponse.json()

    if (!tokenResponse.ok || !tokens.access_token) {
      return redirect(new URL("/signup?error=google-token", editorOrigin).href)
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileResponse.json()

    if (!profileResponse.ok || !profile.sub || !profile.email || profile.email_verified === false) {
      return redirect(new URL("/signup?error=google-profile", editorOrigin).href)
    }

    const now = new Date().toISOString()
    let user = await env.DB.prepare("SELECT * FROM users WHERE google_sub = ? OR email = ? LIMIT 1")
      .bind(profile.sub, profile.email)
      .first()

    if (user) {
      await env.DB.prepare(
        `UPDATE users
         SET google_sub = ?, email = ?, display_name = ?, updated_at = ?
         WHERE id = ?`
      ).bind(profile.sub, profile.email, profile.name || profile.email, now, user.id).run()
    } else {
      const id = makeId(12)
      await env.DB.prepare(
        `INSERT INTO users (id, google_sub, email, display_name, username, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, 'user', ?, ?)`
      ).bind(id, profile.sub, profile.email, profile.name || profile.email, now, now).run()
      user = { id, username: "", role: "user" }
    }

    const sessionToken = randomToken(32)
    const sessionHash = await sha256(sessionToken)
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()

    await env.DB.prepare(
      `INSERT INTO sessions (id_hash, user_id, expires_at, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(sessionHash, user.id, expiresAt, now, now).run()

    const headers = new Headers({
      location: new URL(user.username || user.role === "owner" ? "/admin" : "/signup?choose=username", editorOrigin).href,
      "cache-control": "no-store",
    })
    headers.append("set-cookie", cookie(SESSION_COOKIE, sessionToken, {
      maxAge: SESSION_DAYS * 24 * 60 * 60,
      request,
    }))
    headers.append("set-cookie", cookie(OAUTH_STATE_COOKIE, "", { maxAge: 0, request }))
    headers.append("set-cookie", cookie(OAUTH_VERIFIER_COOKIE, "", { maxAge: 0, request }))
    return new Response(null, { status: 302, headers })
  }

  async function usernameAvailability(request, env) {
    const candidate = new URL(request.url).searchParams.get("value") || ""
    const username = normalizeUsername(candidate)

    if (!username) {
      return json({
        available: false,
        normalized: String(candidate).trim().toLowerCase(),
        error: "Use 3-30 lowercase letters, numbers, or hyphens.",
      })
    }

    const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ? LIMIT 1")
      .bind(username)
      .first()

    return json({ available: !existing, normalized: username })
  }

  async function chooseUsername(request, env) {
    const user = await currentUser(request, env)
    if (!user) return json({ error: "Sign in before choosing a username." }, { status: 401 })
    if (user.role === "owner") return json({ user: publicUser(user) })

    const body = await request.json()
    const username = normalizeUsername(body.username)

    if (!username) {
      return json({ error: "Use 3-30 lowercase letters, numbers, or hyphens." }, { status: 400 })
    }

    const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1")
      .bind(username, user.id)
      .first()

    if (existing) return json({ error: "That username is already taken." }, { status: 409 })

    const now = new Date().toISOString()
    await env.DB.prepare("UPDATE users SET username = ?, updated_at = ? WHERE id = ?")
      .bind(username, now, user.id)
      .run()

    const updated = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first()
    return json({ user: publicUser(updated) })
  }

  async function logout(request, env) {
    const token = cookieValue(request, SESSION_COOKIE)
    if (token && env.DB) {
      await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await sha256(token)).run()
    }

    return json({ ok: true }, {
      headers: { "set-cookie": cookie(SESSION_COOKIE, "", { maxAge: 0, request }) },
    })
  }

  return {
    authStatus,
    beginGoogleAuth,
    chooseUsername,
    currentUser,
    finishGoogleAuth,
    logout,
    usernameAvailability,
  }
}
