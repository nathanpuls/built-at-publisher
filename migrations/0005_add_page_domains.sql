ALTER TABLE pages ADD COLUMN domain TEXT NOT NULL DEFAULT 'built.at';

DROP INDEX IF EXISTS pages_path_idx;

CREATE UNIQUE INDEX IF NOT EXISTS pages_domain_path_idx
ON pages (domain, path)
WHERE path <> '';

CREATE INDEX IF NOT EXISTS pages_domain_updated_at_idx
ON pages (domain, updated_at DESC);

DROP INDEX IF EXISTS pages_home_idx;

CREATE INDEX IF NOT EXISTS pages_domain_home_idx
ON pages (domain, is_home, updated_at DESC);
