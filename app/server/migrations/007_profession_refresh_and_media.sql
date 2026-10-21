ALTER TABLE profs_scopes ADD COLUMN api_backoff_until timestamptz;
ALTER TABLE profs_jobs ADD COLUMN priority integer NOT NULL DEFAULT 10;
ALTER TABLE profs_recipes ADD COLUMN icon_url text;
ALTER TABLE profs_recipes ADD COLUMN metadata_version integer NOT NULL DEFAULT 0;
ALTER TABLE profs_recipes ADD COLUMN detail_priority timestamptz;
CREATE INDEX profs_jobs_priority ON profs_jobs(scope_id,priority DESC,created_at);
