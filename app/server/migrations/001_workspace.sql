CREATE TABLE users (
  id uuid PRIMARY KEY, username text NOT NULL UNIQUE,
  password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE guilds (
  id uuid PRIMARY KEY, name text NOT NULL,
  region text NOT NULL CHECK (region IN ('us','eu','kr','tw')),
  ruleset text NOT NULL CHECK (ruleset IN ('normal','pvp','roleplaying')),
  faction text NOT NULL CHECK (faction IN ('alliance','horde'))
);
CREATE TABLE guild_access (
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','officer')),
  PRIMARY KEY (guild_id, user_id)
);
CREATE UNIQUE INDEX one_guild_owner ON guild_access(guild_id) WHERE role = 'owner';
CREATE TABLE sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE invitations (
  id uuid PRIMARY KEY, guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE, created_by uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL, used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE roster_members (
  id uuid PRIMARY KEY, guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  display_name text NOT NULL, notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','trial','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(), revision integer NOT NULL DEFAULT 1, UNIQUE (id, guild_id)
);
CREATE UNIQUE INDEX member_name_per_guild ON roster_members(guild_id, lower(display_name));
CREATE TABLE characters (
  id uuid PRIMARY KEY, guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  member_id uuid NOT NULL, first_name text NOT NULL, last_name text NOT NULL,
  region text NOT NULL CHECK (region IN ('us','eu','kr','tw')),
  class text NOT NULL CHECK (class IN ('druid','hunter','mage','paladin','priest','rogue','shaman','warlock','warrior')),
  race text NOT NULL, faction text NOT NULL CHECK (faction IN ('alliance','horde')),
  ruleset text NOT NULL CHECK (ruleset IN ('normal','pvp','roleplaying')),
  level integer NOT NULL CHECK (level BETWEEN 1 AND 60),
  build text NOT NULL DEFAULT '', off_build text NOT NULL DEFAULT '',
  preferred_role text NOT NULL CHECK (preferred_role IN ('tank','healer','melee','ranged')),
  is_main boolean NOT NULL DEFAULT false, notes text NOT NULL DEFAULT '',
  confirmed_capabilities jsonb NOT NULL DEFAULT '[]', archived boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(), revision integer NOT NULL DEFAULT 1,
  UNIQUE (id, guild_id), UNIQUE (id, member_id, guild_id),
  FOREIGN KEY (member_id, guild_id) REFERENCES roster_members(id, guild_id)
);
CREATE UNIQUE INDEX character_identity_per_guild ON characters(guild_id, region, lower(first_name), lower(last_name));
CREATE UNIQUE INDEX one_main_per_member ON characters(member_id) WHERE is_main AND NOT archived;
CREATE TABLE plans (
  id uuid PRIMARY KEY, guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  name text NOT NULL, encounter text NOT NULL, capacity integer NOT NULL CHECK (capacity BETWEEN 5 AND 40),
  notes text NOT NULL DEFAULT '', starts_at timestamptz, timezone text NOT NULL DEFAULT 'America/New_York',
  targets jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, catalog_version text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (id, guild_id)
);
CREATE TABLE assignments (
  id uuid PRIMARY KEY, guild_id uuid NOT NULL, plan_id uuid NOT NULL,
  character_id uuid NOT NULL, member_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('tank','healer','melee','ranged')),
  status text NOT NULL CHECK (status IN ('lineup','bench')),
  group_number integer CHECK (group_number BETWEEN 1 AND 8),
  attendance text NOT NULL DEFAULT 'unmarked' CHECK (attendance IN ('unmarked','present','late','absent')),
  FOREIGN KEY (plan_id, guild_id) REFERENCES plans(id, guild_id) ON DELETE CASCADE,
  FOREIGN KEY (character_id, member_id, guild_id) REFERENCES characters(id, member_id, guild_id),
  UNIQUE (plan_id, character_id), UNIQUE (plan_id, member_id)
);
CREATE TABLE activity (
  id uuid PRIMARY KEY, guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL, action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_guild_time ON activity(guild_id, created_at DESC);
