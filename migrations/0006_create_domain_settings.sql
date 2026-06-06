CREATE TABLE IF NOT EXISTS domain_settings (
  domain TEXT PRIMARY KEY,
  favicon_url TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
