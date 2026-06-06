CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  slug TEXT,
  title TEXT NOT NULL DEFAULT 'Untitled',
  markdown TEXT NOT NULL DEFAULT '',
  json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS pages_updated_at_idx
ON pages (updated_at DESC);

CREATE INDEX IF NOT EXISTS pages_status_updated_at_idx
ON pages (status, updated_at DESC);
