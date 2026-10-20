-- Give former collaborators their own empty planner while preserving each existing owner's data.
WITH personal AS (
  SELECT u.id AS user_id,gen_random_uuid() AS guild_id,u.username,
    coalesce(previous.region,'us') AS region,
    coalesce(previous.ruleset,'normal') AS ruleset,
    coalesce(previous.faction,'alliance') AS faction
  FROM users u
  LEFT JOIN LATERAL (
    SELECT g.region,g.ruleset,g.faction FROM guild_access a JOIN guilds g ON g.id=a.guild_id
    WHERE a.user_id=u.id ORDER BY g.id LIMIT 1
  ) previous ON true
  WHERE NOT EXISTS (SELECT 1 FROM guild_access a WHERE a.user_id=u.id AND a.role='owner')
), created AS (
  INSERT INTO guilds(id,name,region,ruleset,faction)
  SELECT guild_id,username || ' raids',region,ruleset,faction FROM personal RETURNING id
)
INSERT INTO guild_access(guild_id,user_id,role)
SELECT p.guild_id,p.user_id,'owner' FROM personal p JOIN created c ON c.id=p.guild_id;
DELETE FROM guild_access WHERE role='officer';
DELETE FROM invitations;
