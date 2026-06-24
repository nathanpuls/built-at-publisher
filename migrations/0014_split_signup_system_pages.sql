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
)
SELECT
  'builtChooseUsername',
  'choose-username',
  'Choose username',
  'system:choose-username:v1',
  '',
  '{"type":"doc","content":[{"type":"paragraph"}]}',
  'published',
  datetime('now'),
  datetime('now'),
  datetime('now'),
  CASE
    WHEN instr(source, char(10) || char(10) || '---' || char(10) || char(10)) > 0
      THEN substr(
        source,
        instr(source, char(10) || char(10) || '---' || char(10) || char(10)) + 7
      )
    ELSE ''
  END,
  source_type,
  '/system/choose-username',
  'built.at',
  0,
  '',
  'manual',
  'built-at-owner',
  'system'
FROM pages
WHERE id = 'builtSignup';

UPDATE pages
SET
  slug = 'sign-in',
  title = 'Sign in',
  path = '/system/sign-in',
  source = CASE
    WHEN instr(source, char(10) || char(10) || '---' || char(10) || char(10)) > 0
      THEN substr(
        source,
        1,
        instr(source, char(10) || char(10) || '---' || char(10) || char(10)) - 1
      )
    ELSE source
  END,
  hash = 'system:sign-in:v2',
  updated_at = datetime('now')
WHERE id = 'builtSignup';
