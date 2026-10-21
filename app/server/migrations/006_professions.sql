-- A shared directory alongside, and independent of, private raid planners.
CREATE TABLE profs_scopes (
  id text PRIMARY KEY,
  game_version text NOT NULL,
  region text NOT NULL CHECK (region IN ('us','eu','kr','tw')),
  profile_namespace text NOT NULL,
  data_namespace text NOT NULL,
  guild_name text NOT NULL,
  guild_realm text NOT NULL,
  guild_api_id bigint,
  roster_synced timestamptz,
  roster_error text,
  roster_refresh_after timestamptz,
  UNIQUE (game_version,region)
);
CREATE TABLE profs_characters (
  id uuid PRIMARY KEY,
  scope_id text NOT NULL REFERENCES profs_scopes(id),
  api_id bigint NOT NULL,
  name text NOT NULL,
  realm text NOT NULL,
  in_roster boolean NOT NULL DEFAULT false,
  seed boolean NOT NULL DEFAULT false,
  snapshot jsonb,
  last_success timestamptz,
  last_attempt timestamptz,
  refresh_after timestamptz,
  error text,
  UNIQUE (scope_id,realm,name),
  UNIQUE (scope_id,api_id),
  UNIQUE (id,scope_id)
);
CREATE TABLE profs_recipes (
  scope_id text NOT NULL REFERENCES profs_scopes(id),
  api_id bigint NOT NULL,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  details_fetched timestamptz,
  detail_attempt timestamptz,
  detail_error text,
  PRIMARY KEY (scope_id,api_id)
);
CREATE TABLE profs_known_recipes (
  character_id uuid NOT NULL,
  scope_id text NOT NULL,
  recipe_id bigint NOT NULL,
  profession text NOT NULL,
  expansion text NOT NULL,
  PRIMARY KEY (character_id,recipe_id,profession,expansion),
  FOREIGN KEY (character_id,scope_id) REFERENCES profs_characters(id,scope_id) ON DELETE CASCADE,
  FOREIGN KEY (scope_id,recipe_id) REFERENCES profs_recipes(scope_id,api_id)
);
CREATE INDEX profs_recipe_owners ON profs_known_recipes(scope_id,recipe_id);
CREATE TABLE profs_claims (
  id uuid PRIMARY KEY,
  scope_id text NOT NULL,
  character_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (character_id,scope_id) REFERENCES profs_characters(id,scope_id) ON DELETE CASCADE,
  UNIQUE (character_id,user_id)
);
CREATE UNIQUE INDEX profs_one_owner ON profs_claims(character_id) WHERE status='approved';
CREATE TABLE profs_members (
  scope_id text NOT NULL REFERENCES profs_scopes(id),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discord text NOT NULL DEFAULT '',
  main_character_id uuid,
  PRIMARY KEY (scope_id,user_id),
  FOREIGN KEY (main_character_id,scope_id) REFERENCES profs_characters(id,scope_id)
);
CREATE TABLE profs_jobs (
  id uuid PRIMARY KEY,
  scope_id text NOT NULL REFERENCES profs_scopes(id),
  character_id uuid,
  kind text NOT NULL CHECK (kind IN ('roster','character')),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  lease_until timestamptz,
  FOREIGN KEY (character_id,scope_id) REFERENCES profs_characters(id,scope_id) ON DELETE CASCADE,
  CHECK ((kind='roster' AND character_id IS NULL) OR (kind='character' AND character_id IS NOT NULL))
);
CREATE UNIQUE INDEX profs_one_character_job ON profs_jobs(character_id) WHERE character_id IS NOT NULL;
CREATE UNIQUE INDEX profs_one_roster_job ON profs_jobs(scope_id) WHERE kind='roster';
