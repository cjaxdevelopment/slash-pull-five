-- Keep legacy person records and links for data preservation, but require no person for new characters.
ALTER TABLE characters ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE characters ADD COLUMN spec text NOT NULL DEFAULT 'custom';
ALTER TABLE characters ADD COLUMN buffs jsonb NOT NULL DEFAULT '[]';
UPDATE characters SET buffs = CASE class
  WHEN 'druid' THEN '["mark_of_the_wild"]'::jsonb
  WHEN 'mage' THEN '["arcane_intellect"]'::jsonb
  WHEN 'priest' THEN '["fortitude","divine_spirit"]'::jsonb
  WHEN 'warrior' THEN '["battle_shout"]'::jsonb
  ELSE '[]'::jsonb END;
ALTER TABLE assignments DROP CONSTRAINT assignments_character_id_member_id_guild_id_fkey;
ALTER TABLE assignments DROP CONSTRAINT assignments_plan_id_member_id_key;
ALTER TABLE assignments ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE assignments ADD CONSTRAINT assignment_character_workspace_fk
  FOREIGN KEY (character_id,guild_id) REFERENCES characters(id,guild_id);
