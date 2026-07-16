CREATE TABLE IF NOT EXISTS page_favicon_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT NOT NULL,
  favicon_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS page_favicon_history_page_created_idx
ON page_favicon_history (page_id, created_at DESC);

INSERT INTO page_favicon_history (page_id, favicon_url, created_at)
SELECT id, favicon_url, updated_at
FROM pages
WHERE favicon_url <> '';
