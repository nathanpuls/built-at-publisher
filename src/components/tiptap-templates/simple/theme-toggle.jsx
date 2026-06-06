// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"

// --- Icons ---
import { MoonStarIcon } from "@/components/tiptap-icons/moon-star-icon"
import { SunIcon } from "@/components/tiptap-icons/sun-icon"
import { useEffect, useState } from "react"

export const THEME_KEY = "simple-editor:theme"

export function getStoredTheme() {
  try {
    const theme = window.localStorage?.getItem(THEME_KEY)
    return theme === "dark" || theme === "light" ? theme : null
  } catch {
    return null
  }
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function getInitialTheme() {
  return getStoredTheme() ||
    (document.querySelector('meta[name="color-scheme"][content="dark"]') ? "dark" : getSystemTheme())
}

export function applyTheme(theme = getInitialTheme()) {
  document.documentElement.classList.toggle("dark", theme === "dark")
  document.documentElement.style.colorScheme = theme
  return theme
}

export function storeTheme(theme) {
  try {
    window.localStorage?.setItem(THEME_KEY, theme)
  } catch {
    // Theme still changes for this session if storage is unavailable.
  }
}

export function ThemeToggle({ className }) {
  const [theme, setTheme] = useState(() => applyTheme())
  const isDarkMode = theme === "dark"

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = () => {
      if (!getStoredTheme()) {
        setTheme(mediaQuery.matches ? "dark" : "light")
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleDarkMode = () => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark"
      storeTheme(nextTheme)
      return nextTheme
    })
  }

  return (
    <Button
      onClick={toggleDarkMode}
      aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
      className={className}
      variant="ghost">
      {isDarkMode ? (
        <MoonStarIcon className="tiptap-button-icon" />
      ) : (
        <SunIcon className="tiptap-button-icon" />
      )}
    </Button>
  );
}
