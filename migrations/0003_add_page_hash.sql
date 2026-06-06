ALTER TABLE pages ADD COLUMN hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS pages_hash_idx
ON pages (hash);
