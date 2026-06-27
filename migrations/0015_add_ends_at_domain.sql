INSERT OR IGNORE INTO user_domains (domain, owner_id, status, created_at, updated_at)
VALUES ('ends.at', 'built-at-owner', 'active', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO domain_settings (domain, favicon_url, updated_at)
VALUES ('ends.at', '', datetime('now'));
