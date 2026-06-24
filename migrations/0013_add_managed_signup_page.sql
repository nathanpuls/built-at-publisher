INSERT OR IGNORE INTO pages (
  id,
  slug,
  title,
  hash,
  markdown,
  json,
  status,
  created_at,
  updated_at,
  published_at,
  source,
  source_type,
  path,
  domain,
  is_home,
  favicon_url,
  title_mode,
  owner_id,
  namespace
) VALUES (
  'builtSignup',
  'signup',
  'Signup',
  'system:signup:v1',
  '',
  '{"type":"doc","content":[{"type":"paragraph"}]}',
  'published',
  datetime('now'),
  datetime('now'),
  datetime('now'),
  '# Create your Built.at account

Sign in, choose your username, and publish at built.at/username.

---

# Choose your username

This becomes the first part of every page you publish.',
  'markdown',
  '/system/signup',
  'built.at',
  0,
  '',
  'manual',
  'built-at-owner',
  'system'
);
