import { useEffect, useRef, useState } from "react"
import { renderSource } from "../lib/content"

const DEFAULT_SIGNUP_SOURCE = `# Create your Built.at account

Sign in, choose your username, and publish at built.at/username.

---

# Choose your username

This becomes the first part of every page you publish.`

async function readJson(response) {
  const text = await response.text()
  return text ? JSON.parse(text) : {}
}

function errorMessage(code) {
  if (code === "google-not-configured") return "Google sign-in is not configured yet."
  if (code === "invalid-oauth-state") return "That sign-in expired. Please try again."
  if (code === "google-token" || code === "google-profile") return "Google sign-in could not be completed."
  return ""
}

export function SignupPage() {
  const [status, setStatus] = useState({ loading: true, configured: false, user: null, needsUsername: false })
  const [username, setUsername] = useState("")
  const [availability, setAvailability] = useState({ checking: false, available: false, message: "" })
  const [error, setError] = useState(errorMessage(new URLSearchParams(window.location.search).get("error")))
  const [signupSource, setSignupSource] = useState(DEFAULT_SIGNUP_SOURCE)
  const usernameRef = useRef(null)
  const [signInSource, usernameSource = ""] = signupSource.split(/\n\s*---\s*\n/, 2)

  useEffect(() => {
    let cancelled = false

    fetch("/api/system/signup")
      .then(readJson)
      .then((data) => {
        if (!cancelled && data.page?.source?.trim()) setSignupSource(data.page.source)
      })
      .catch(() => {})

    fetch("/api/auth/status")
      .then(readJson)
      .then((data) => {
        if (cancelled) return
        setStatus({ loading: false, ...data })

        if (data.user?.username) {
          window.location.replace("/admin")
          return
        }

        if (data.user) {
          window.requestAnimationFrame(() => usernameRef.current?.focus())
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus((current) => ({ ...current, loading: false }))
          setError("Could not load sign-in.")
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!status.user || !username.trim()) {
      setAvailability({ checking: false, available: false, message: "" })
      return undefined
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setAvailability({ checking: true, available: false, message: "" })

      try {
        const response = await fetch(`/api/auth/username?value=${encodeURIComponent(username)}`, {
          signal: controller.signal,
        })
        const data = await readJson(response)
        setAvailability({
          checking: false,
          available: Boolean(data.available),
          message: data.available ? "Available" : data.error || "Already taken",
        })
      } catch (availabilityError) {
        if (availabilityError.name !== "AbortError") {
          setAvailability({ checking: false, available: false, message: "Could not check that username" })
        }
      }
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [status.user, username])

  async function saveUsername(event) {
    event.preventDefault()
    setError("")

    try {
      const response = await fetch("/api/auth/username", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username }),
      })
      const data = await readJson(response)
      if (!response.ok) throw new Error(data.error || "Could not save that username.")
      window.location.replace("/admin")
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <main className="signup-shell">
      <section className="signup-panel">
        <a className="signup-brand" href="/">built.at</a>

        {status.loading ? <p className="signup-muted">Loading</p> : null}

        {!status.loading && !status.user ? (
          <>
            <div className="signup-copy" dangerouslySetInnerHTML={{ __html: renderSource(signInSource) }} />
            <a className={`google-signin ${status.configured ? "" : "is-disabled"}`} href={status.configured ? "/api/auth/google" : undefined} aria-disabled={!status.configured}>
              <span aria-hidden="true">G</span>
              Continue with Google
            </a>
            {!status.configured ? <p className="signup-note">Google sign-in needs its client ID and secret before this can accept accounts.</p> : null}
          </>
        ) : null}

        {!status.loading && status.user && !status.user.username ? (
          <>
            <div className="signup-copy">
              <span className="signup-account">{status.user.email}</span>
              <div dangerouslySetInnerHTML={{ __html: renderSource(usernameSource || signInSource) }} />
            </div>
            <form className="username-form" onSubmit={saveUsername}>
              <label htmlFor="username">Username</label>
              <div className="username-control">
                <span>built.at/</span>
                <input
                  ref={usernameRef}
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  autoCapitalize="none"
                  autoComplete="username"
                  spellCheck="false"
                  placeholder="your-name"
                />
              </div>
              <span className={`username-status ${availability.available ? "is-available" : ""}`}>
                {availability.checking ? "Checking" : availability.message}
              </span>
              <button className="primary" type="submit" disabled={!availability.available}>Create account</button>
            </form>
          </>
        ) : null}

        {error ? <p className="signup-error">{error}</p> : null}
      </section>
    </main>
  )
}
