ALTER TABLE pages ADD COLUMN deleted_at TEXT;

DROP INDEX IF EXISTS pages_domain_path_idx;

CREATE UNIQUE INDEX IF NOT EXISTS pages_domain_path_active_idx
ON pages (domain, path)
WHERE path <> '' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS pages_domain_deleted_at_idx
ON pages (domain, deleted_at DESC);
