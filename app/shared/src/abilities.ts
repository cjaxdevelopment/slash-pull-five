import type { BuffDefinition } from './buffs.js';
import type { CharacterClass } from './index.js';
const client = (cls: string, spell: string) =>
  'https://theforeverera.com/en/spells/' + cls + '/' + spell + '/';
const petSource = 'https://theforeverera.com/en/hunter-pets/';
const warlockSource =
  'https://news.blizzard.com/en-us/article/24310968/world-of-warcraft-forever-class-deep-dives-rogue-and-warlock';
const spell = (
  id: string,
  name: string,
  cls: CharacterClass,
  effect: string,
  category: 'buff' | 'debuff' | 'utility',
  scope: BuffDefinition['scope'],
  options: Partial<BuffDefinition> = {},
): BuffDefinition => ({
  id,
  name,
  class: cls,
  effect,
  category,
  scope,
  source: client(
    cls,
    name.toLowerCase().replaceAll("'", '').replaceAll(':', '').replaceAll(' ', '-'),
  ),
  ...options,
});
// Coverage is planned availability, not simulated strength, stacking magnitudes or uptime.
// Personal-only vulnerabilities and removed Classic talents are deliberately excluded.
export const additionalAbilities: BuffDefinition[] = [
  spell('thorns', 'Thorns', 'druid', 'Damage reflection', 'buff', 'raid', {
    note: 'Castable across the raid. Target assignments and exact damage are not simulated.',
  }),
  spell('shadow_protection', 'Shadow Protection', 'priest', 'Shadow resistance', 'buff', 'raid'),
  spell('retribution_aura', 'Retribution Aura', 'paladin', 'Damage reflection', 'buff', 'party', {
    slot: 'aura',
  }),
  spell('blood_pact', 'Blood Pact', 'warlock', 'Stamina (Imp)', 'buff', 'party', {
    pet: 'imp',
    source: 'https://forever.warcraftdb.com/data/spell/11767',
    note: 'Requires a living, active Imp in range. Improved Imp no longer improves Blood Pact in Forever.',
  }),
  spell('furious_howl', 'Furious Howl', 'hunter', 'Melee attack power (Wolf)', 'buff', 'raid', {
    pet: 'wolf',
    source: petSource,
    note: 'Requires an active Wolf. The extracted Forever tooltip covers party or raid members in range.',
  }),
  spell('faerie_fire', 'Faerie Fire', 'druid', 'Armor reduction (Faerie Fire)', 'debuff', 'enemy'),
  spell(
    'demoralizing_roar',
    'Demoralizing Roar',
    'druid',
    'Melee attack power reduction',
    'debuff',
    'enemy',
  ),
  spell('insect_swarm', 'Insect Swarm', 'druid', 'Hit chance reduction', 'debuff', 'enemy', {
    talent: true,
  }),
  spell(
    'hunters_mark',
    "Hunter's Mark",
    'hunter',
    'Ranged attack power vs target',
    'debuff',
    'enemy',
  ),
  spell('scorpid_sting', 'Scorpid Sting', 'hunter', 'Hit chance reduction', 'debuff', 'enemy', {
    slot: 'sting',
    note: 'One maintained Sting per Hunter. Selecting this assumes it is used instead of a damaging Sting.',
  }),
  spell(
    'demoralizing_screech',
    'Demoralizing Screech',
    'hunter',
    'Melee attack power reduction',
    'debuff',
    'enemy',
    { pet: 'carrion_bird', source: petSource },
  ),
  spell('sonic_blast', 'Sonic Blast', 'hunter', 'Cast speed reduction', 'debuff', 'enemy', {
    pet: 'bat',
    source:
      'https://us.forums.blizzard.com/en/wow/t/wow-forever-beta-development-notes-%E2%80%93-updated-october-15/2360696/6',
  }),
  spell('dismember', 'Dismember', 'hunter', 'Healing reduction', 'debuff', 'enemy', {
    pet: 'crocolisk',
    source:
      'https://us.forums.blizzard.com/en/wow/t/wow-forever-beta-development-notes-%E2%80%93-updated-october-15/2360696/6',
  }),
  spell('sunder_armor', 'Sunder Armor', 'warrior', 'Major armor reduction', 'debuff', 'enemy', {
    note: 'Availability only; Expose Armor may be stronger. The values are not added together.',
  }),
  spell('expose_armor', 'Expose Armor', 'rogue', 'Major armor reduction', 'debuff', 'enemy', {
    note: 'Improved Expose Armor changes cost and Combo Points in Forever, not its strength.',
  }),
  spell('thunder_clap', 'Thunder Clap', 'warrior', 'Attack speed reduction', 'debuff', 'enemy'),
  spell(
    'demoralizing_shout',
    'Demoralizing Shout',
    'warrior',
    'Melee attack power reduction',
    'debuff',
    'enemy',
  ),
  spell('mortal_strike', 'Mortal Strike', 'warrior', 'Healing reduction', 'debuff', 'enemy', {
    talent: true,
  }),
  spell('wound_poison', 'Wound Poison', 'rogue', 'Healing reduction', 'debuff', 'enemy', {
    note: 'Assumes Wound Poison is equipped.',
  }),
  spell(
    'mind_numbing_poison',
    'Mind-numbing Poison',
    'rogue',
    'Cast speed reduction',
    'debuff',
    'enemy',
    { source: client('rogue', 'mind-numbing-poison'), note: 'Assumes this Poison is equipped.' },
  ),
  spell(
    'curse_of_elements',
    'Curse of the Elements',
    'warlock',
    'Magic damage vulnerability',
    'debuff',
    'enemy',
    {
      slot: 'curse',
      note: 'Affects all magic schools in Forever. One maintained Curse per Warlock; Banes are separate.',
    },
  ),
  spell(
    'curse_of_recklessness',
    'Curse of Recklessness',
    'warlock',
    'Armor reduction (curse)',
    'debuff',
    'enemy',
    { slot: 'curse' },
  ),
  spell(
    'curse_of_weakness',
    'Curse of Weakness',
    'warlock',
    'Physical damage reduction on enemy',
    'debuff',
    'enemy',
    { slot: 'curse' },
  ),
  spell(
    'curse_of_tongues',
    'Curse of Tongues',
    'warlock',
    'Cast speed reduction',
    'debuff',
    'enemy',
    { slot: 'curse' },
  ),
  spell(
    'judgement_of_wisdom',
    'Judgement of Wisdom',
    'paladin',
    'Mana return on attacks',
    'debuff',
    'enemy',
    { slot: 'judgement', source: client('paladin', 'seal-of-wisdom') },
  ),
  spell(
    'judgement_of_light',
    'Judgement of Light',
    'paladin',
    'Healing return on attacks',
    'debuff',
    'enemy',
    { slot: 'judgement', source: client('paladin', 'seal-of-light') },
  ),
  spell('pummel', 'Pummel', 'warrior', 'Interrupt', 'utility', 'enemy', {
    note: 'Requires the appropriate stance and equipment.',
  }),
  spell('kick', 'Kick', 'rogue', 'Interrupt', 'utility', 'enemy'),
  spell('counterspell', 'Counterspell', 'mage', 'Interrupt', 'utility', 'enemy'),
  spell('earth_shock', 'Earth Shock', 'shaman', 'Interrupt', 'utility', 'enemy'),
  spell('silence', 'Silence', 'priest', 'Interrupt', 'utility', 'enemy', {
    talent: true,
    note: 'Silence effectiveness depends on the target. Not every boss can be silenced.',
  }),
  spell('spell_lock', 'Spell Lock', 'warlock', 'Interrupt', 'utility', 'enemy', {
    pet: 'felhunter',
    source: warlockSource,
  }),
  spell('dispel_magic', 'Dispel Magic', 'priest', 'Magic dispel', 'utility', 'target'),
  spell('priest_purge', 'Dispel Magic', 'priest', 'Magic purge', 'utility', 'enemy'),
  spell('cleanse_magic', 'Cleanse', 'paladin', 'Magic dispel', 'utility', 'target'),
  spell('cleanse_poison', 'Cleanse', 'paladin', 'Poison cleanse', 'utility', 'target'),
  spell('cleanse_disease', 'Cleanse', 'paladin', 'Disease cleanse', 'utility', 'target'),
  spell('remove_curse', 'Remove Curse', 'druid', 'Curse / Bane cleanse', 'utility', 'target'),
  spell(
    'remove_lesser_curse',
    'Remove Lesser Curse',
    'mage',
    'Curse / Bane cleanse',
    'utility',
    'target',
  ),
  spell('druid_cure_poison', 'Cure Poison', 'druid', 'Poison cleanse', 'utility', 'target'),
  spell('shaman_cure_poison', 'Cure Poison', 'shaman', 'Poison cleanse', 'utility', 'target'),
  spell('shaman_cure_disease', 'Cure Disease', 'shaman', 'Disease cleanse', 'utility', 'target'),
  spell('priest_cure_disease', 'Cure Disease', 'priest', 'Disease cleanse', 'utility', 'target'),
  spell('purge', 'Purge', 'shaman', 'Magic purge', 'utility', 'enemy'),
  spell('devour_magic', 'Devour Magic', 'warlock', 'Magic dispel', 'utility', 'target', {
    pet: 'felhunter',
    source: warlockSource,
  }),
  spell('devour_magic_purge', 'Devour Magic', 'warlock', 'Magic purge', 'utility', 'enemy', {
    pet: 'felhunter',
    source: warlockSource,
  }),
  spell('tranquilizing_shot', 'Tranquilizing Shot', 'hunter', 'Enrage removal', 'utility', 'enemy'),
  spell('rebirth', 'Rebirth', 'druid', 'Combat resurrection', 'utility', 'target'),
  spell(
    'soulstone',
    'Soulstone Resurrection',
    'warlock',
    'Soulstone resurrection',
    'utility',
    'target',
    {
      source: client('warlock', 'create-soulstone'),
      note: 'Requires a prepared Soulstone. This is resurrection support, not an unrestricted combat-resurrection cast.',
    },
  ),
  spell('reincarnation', 'Reincarnation', 'shaman', 'Self resurrection', 'utility', 'self'),
  spell('healthstone', 'Create Healthstone', 'warlock', 'Healthstones', 'utility', 'raid'),
  spell('ritual_of_summoning', 'Ritual of Summoning', 'warlock', 'Summoning', 'utility', 'raid'),
  spell('conjure_water', 'Conjure Water', 'mage', 'Conjured supplies', 'utility', 'raid'),
  spell('innervate', 'Innervate', 'druid', 'Mana cooldown', 'utility', 'target'),
  spell('mana_tide', 'Mana Tide Totem', 'shaman', 'Mana cooldown', 'utility', 'party', {
    talent: true,
    note: 'Temporary water totem; replaces the maintained water totem while active.',
  }),
  spell(
    'power_infusion',
    'Power Infusion',
    'priest',
    'Spell damage cooldown',
    'utility',
    'target',
    { talent: true },
  ),
  spell('tranquility', 'Tranquility', 'druid', 'Group healing cooldown', 'utility', 'party'),
  spell(
    'vampiric_embrace',
    'Vampiric Embrace',
    'priest',
    'Group healing cooldown',
    'utility',
    'party',
    { talent: true },
  ),
  spell('fear_ward', 'Fear Ward', 'priest', 'Fear prevention / removal', 'utility', 'target', {
    note: 'Baseline for every Priest in Forever.',
  }),
  spell('tremor_totem', 'Tremor Totem', 'shaman', 'Fear prevention / removal', 'utility', 'party', {
    note: 'Situational earth totem; replaces the maintained earth totem while active. Also handles Charm and Sleep.',
  }),
  spell(
    'blessing_of_protection',
    'Blessing of Protection',
    'paladin',
    'Physical immunity',
    'utility',
    'target',
  ),
  spell(
    'blessing_of_freedom',
    'Blessing of Freedom',
    'paladin',
    'Movement freedom',
    'utility',
    'target',
  ),
  spell('hammer_of_justice', 'Hammer of Justice', 'paladin', 'Stun', 'utility', 'enemy'),
  spell('intimidation', 'Intimidation', 'hunter', 'Stun', 'utility', 'enemy', {
    talent: true,
    note: 'Requires an active pet.',
  }),
  spell('concussion_blow', 'Concussion Blow', 'warrior', 'Stun', 'utility', 'enemy', {
    talent: true,
  }),
  spell('kidney_shot', 'Kidney Shot', 'rogue', 'Stun', 'utility', 'enemy'),
  spell('polymorph', 'Polymorph', 'mage', 'Crowd control', 'utility', 'enemy', {
    note: 'Humanoids and beasts; target restrictions apply.',
  }),
  spell('hibernate', 'Hibernate', 'druid', 'Crowd control', 'utility', 'enemy', {
    note: 'Beasts and dragonkin; target restrictions apply.',
  }),
  spell('entangling_roots', 'Entangling Roots', 'druid', 'Root', 'utility', 'enemy'),
  spell('freezing_trap', 'Freezing Trap', 'hunter', 'Crowd control', 'utility', 'enemy'),
  spell('shackle_undead', 'Shackle Undead', 'priest', 'Crowd control', 'utility', 'enemy', {
    note: 'Undead targets only.',
  }),
  spell('sap', 'Sap', 'rogue', 'Crowd control', 'utility', 'enemy', {
    note: 'Humanoid targets; combat restrictions apply.',
  }),
  spell('banish', 'Banish', 'warlock', 'Crowd control', 'utility', 'enemy', {
    note: 'Demons and elementals; target restrictions apply.',
  }),
  spell('seduction', 'Seduction', 'warlock', 'Crowd control', 'utility', 'enemy', {
    pet: 'succubus',
    source: warlockSource,
    note: 'Requires an active Succubus or Incubus; humanoid targets only.',
  }),
];
export const baselineAbilities: Record<CharacterClass, string[]> = {
  druid: [
    'thorns',
    'faerie_fire',
    'demoralizing_roar',
    'remove_curse',
    'druid_cure_poison',
    'rebirth',
    'innervate',
    'tranquility',
    'hibernate',
    'entangling_roots',
  ],
  hunter: ['hunters_mark', 'tranquilizing_shot', 'freezing_trap'],
  mage: ['counterspell', 'remove_lesser_curse', 'polymorph', 'conjure_water'],
  paladin: [
    'cleanse_magic',
    'cleanse_poison',
    'cleanse_disease',
    'blessing_of_protection',
    'blessing_of_freedom',
    'hammer_of_justice',
    'judgement_of_wisdom',
  ],
  priest: [
    'shadow_protection',
    'dispel_magic',
    'priest_purge',
    'priest_cure_disease',
    'fear_ward',
    'shackle_undead',
  ],
  rogue: ['kick', 'expose_armor', 'kidney_shot', 'sap'],
  shaman: [
    'earth_shock',
    'purge',
    'shaman_cure_poison',
    'shaman_cure_disease',
    'tremor_totem',
    'reincarnation',
  ],
  warlock: ['curse_of_elements', 'soulstone', 'healthstone', 'ritual_of_summoning', 'banish'],
  warrior: ['sunder_armor', 'thunder_clap', 'demoralizing_shout', 'pummel'],
};
export const specAbilities: Record<string, string[]> = {
  'druid:balance': ['insect_swarm'],
  'hunter:beast_mastery': ['intimidation'],
  'priest:discipline': ['power_infusion'],
  'priest:shadow': ['silence', 'vampiric_embrace'],
  'shaman:restoration': ['mana_tide'],
  'warrior:arms': ['mortal_strike'],
  'warrior:protection': ['concussion_blow'],
};
export const excludedRaidEffects = [
  {
    name: 'Improved Scorch / Winter’s Chill',
    reason: 'Personal to the Mage in Forever.',
    source:
      'https://news.blizzard.com/en-us/article/24302097/world-of-warcraft-forever-class-deep-dives-mage-and-shaman',
  },
  {
    name: 'Shadow Weaving',
    reason: 'Personal to the Priest in Forever.',
    source:
      'https://news.blizzard.com/en-us/article/24301514/world-of-warcraft-forever-class-deep-dives-priest-and-warrior',
  },
  {
    name: 'Hemorrhage',
    reason: 'Increases only the casting Rogue’s Rupture damage in Forever.',
    source: 'https://theforeverera.com/en/spells/rogue/hemorrhage/',
  },
  {
    name: 'Improved Mark / Fortitude / Battle Shout',
    reason:
      'These old talent improvements are baseline or removed in Forever; no separate talent toggle.',
    source:
      'https://news.blizzard.com/en-us/article/24301515/world-of-warcraft-forever-class-deep-dives-hunter-and-druid',
  },
  {
    name: 'Raid Bloodlust / Tranquil Air / Blessing of Sanctuary',
    reason:
      'Not available as raid support in this Forever ruleset. Rage of the Farseer is personal.',
    source:
      'https://news.blizzard.com/en-us/article/24302097/world-of-warcraft-forever-class-deep-dives-mage-and-shaman',
  },
];
