-- Keep the retail proof-of-concept rows intact in their original scope.
-- Forever uses regional character slugs and a guild ruleset instead of realms.
ALTER TABLE profs_scopes ADD COLUMN guild_slug text NOT NULL DEFAULT '';
ALTER TABLE profs_scopes ADD COLUMN ruleset_id integer NOT NULL DEFAULT 2;
ALTER TABLE profs_scopes ALTER COLUMN guild_realm SET DEFAULT '';
ALTER TABLE profs_characters ADD COLUMN slug text NOT NULL DEFAULT '';
ALTER TABLE profs_characters ALTER COLUMN realm SET DEFAULT '';
CREATE UNIQUE INDEX profs_character_slug ON profs_characters(scope_id,slug) WHERE slug<>'';
