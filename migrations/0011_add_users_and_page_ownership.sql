CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  username TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_expires_idx
ON sessions (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS user_domains (
  domain TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO users (
  id,
  email,
  display_name,
  username,
  role,
  created_at,
  updated_at
) VALUES (
  'built-at-owner',
  '',
  'Built.at',
  NULL,
  'owner',
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO user_domains (domain, owner_id, status, created_at, updated_at)
VALUES
  ('built.at', 'built-at-owner', 'active', datetime('now'), datetime('now')),
  ('nathanpuls.com', 'built-at-owner', 'active', datetime('now'), datetime('now')),
  ('fullpsych.com', 'built-at-owner', 'active', datetime('now'), datetime('now'));

ALTER TABLE pages ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'built-at-owner';
ALTER TABLE pages ADD COLUMN namespace TEXT NOT NULL DEFAULT 'platform';

DROP INDEX IF EXISTS pages_domain_path_active_idx;

CREATE UNIQUE INDEX IF NOT EXISTS pages_namespace_path_active_idx
ON pages (domain, namespace, owner_id, path)
WHERE path <> '' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS pages_owner_updated_at_idx
ON pages (owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS pages_namespace_updated_at_idx
ON pages (namespace, updated_at DESC);
