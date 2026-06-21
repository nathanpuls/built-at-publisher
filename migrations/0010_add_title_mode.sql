ALTER TABLE pages ADD COLUMN title_mode TEXT NOT NULL DEFAULT 'manual';

UPDATE pages
SET
  title_mode = 'auto',
  title = replace(title, '-', ' ')
WHERE
  trim(COALESCE(source, '')) = ''
  AND title = json_extract(
    '["' || replace(trim(path, '/'), '/', '","') || '"]',
    '$[#-1]'
  );

UPDATE pages
SET title_mode = 'auto'
WHERE trim(title) = '';
