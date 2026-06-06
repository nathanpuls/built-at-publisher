CREATE TABLE IF NOT EXISTS domain_favicon_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL,
  favicon_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS domain_favicon_history_domain_created_idx
ON domain_favicon_history (domain, created_at DESC);

INSERT INTO domain_favicon_history (domain, favicon_url, created_at)
SELECT domain, favicon_url, updated_at
FROM domain_settings
WHERE favicon_url <> '';
