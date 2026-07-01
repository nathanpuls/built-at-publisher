CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS projects_owner_slug_idx
ON projects (owner_id, slug);

ALTER TABLE pages ADD COLUMN project_id TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS pages_namespace_path_active_idx;

CREATE UNIQUE INDEX IF NOT EXISTS pages_namespace_project_path_active_idx
ON pages (domain, namespace, owner_id, project_id, path)
WHERE path <> '' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS pages_project_updated_at_idx
ON pages (project_id, updated_at DESC);
