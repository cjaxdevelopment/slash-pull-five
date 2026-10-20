ALTER TABLE assignments ADD COLUMN slot integer CHECK (slot BETWEEN 1 AND 5);
WITH ranked AS (
  SELECT id,row_number() OVER(PARTITION BY plan_id,group_number ORDER BY id) AS position
  FROM assignments WHERE status='lineup' AND group_number IS NOT NULL
) UPDATE assignments a SET slot=CASE WHEN r.position<=5 THEN r.position ELSE NULL END FROM ranked r WHERE a.id=r.id;
ALTER TABLE assignments ADD CONSTRAINT assignment_slot_state CHECK ((status='lineup' AND group_number IS NOT NULL) OR slot IS NULL);
ALTER TABLE assignments ADD CONSTRAINT assignment_position UNIQUE(plan_id,group_number,slot) DEFERRABLE INITIALLY DEFERRED;
-- Add newly tracked baseline abilities without changing chosen auras, totems or talents.
UPDATE characters c SET buffs=(SELECT coalesce(jsonb_agg(DISTINCT ability),'[]'::jsonb) FROM jsonb_array_elements(c.buffs || CASE c.class
WHEN 'druid' THEN '["thorns","faerie_fire","demoralizing_roar","remove_curse","druid_cure_poison","rebirth","innervate","tranquility","hibernate","entangling_roots"]'::jsonb
WHEN 'hunter' THEN '["hunters_mark","tranquilizing_shot","freezing_trap"]'::jsonb
WHEN 'mage' THEN '["counterspell","remove_lesser_curse","polymorph","conjure_water"]'::jsonb
WHEN 'paladin' THEN '["cleanse_magic","cleanse_poison","cleanse_disease","blessing_of_protection","blessing_of_freedom","hammer_of_justice","judgement_of_wisdom"]'::jsonb
WHEN 'priest' THEN '["shadow_protection","dispel_magic","priest_purge","priest_cure_disease","fear_ward","shackle_undead"]'::jsonb
WHEN 'rogue' THEN '["kick","expose_armor","kidney_shot","sap"]'::jsonb
WHEN 'shaman' THEN '["earth_shock","purge","shaman_cure_poison","shaman_cure_disease","tremor_totem","reincarnation"]'::jsonb
WHEN 'warlock' THEN '["curse_of_elements","soulstone","healthstone","ritual_of_summoning","banish"]'::jsonb
WHEN 'warrior' THEN '["sunder_armor","thunder_clap","demoralizing_shout","pummel"]'::jsonb
ELSE '[]'::jsonb END) AS abilities(ability)),revision=revision+1,updated_at=now();
UPDATE plans SET revision=revision+1,updated_at=now(),catalog_version='forever-1.60.1.70450-reviewed-2026-10-20';
