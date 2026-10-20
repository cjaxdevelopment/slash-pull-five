import type { CharacterClass, Role } from './index.js';
import { additionalAbilities, baselineAbilities, specAbilities } from './abilities.js';
export { baselineAbilities, excludedRaidEffects } from './abilities.js';
export const abilityCategories = ['buff', 'debuff', 'utility'] as const;
export type AbilityCategory = (typeof abilityCategories)[number];

const october15 =
  'https://us.forums.blizzard.com/en/wow/t/wow-forever-beta-development-notes-%E2%80%93-updated-october-15/2360696/6';
const paladinPreview = 'https://worldofwarcraft.blizzard.com/en-us/news/24302099';
const client = (cls: string, spell: string) =>
  `https://theforeverera.com/en/spells/${cls}/${spell}/`;
export interface BuffDefinition {
  id: string;
  name: string;
  class: CharacterClass;
  effect: string;
  scope: 'raid' | 'party' | 'enemy' | 'target' | 'self';
  category?: AbilityCategory;
  pet?: string;
  source: string;
  slot?:
    | 'form'
    | 'aura'
    | 'blessing'
    | 'earth'
    | 'air'
    | 'water'
    | 'fire'
    | 'curse'
    | 'sting'
    | 'judgement';
  conflictsWith?: string[];
  note?: string;
  talent?: boolean;
}
// October 15 notes take precedence over earlier previews and cached client tooltips.
// Values and ranks are intentionally not simulated: these are coverage / loadout rules.
export const buffs: BuffDefinition[] = [
  {
    id: 'moonkin_aura',
    name: 'Moonkin Aura',
    class: 'druid',
    effect: 'Spell crit',
    scope: 'raid',
    slot: 'form',
    talent: true,
    source: october15,
    note: 'Requires Moonkin Form. Does not replace Leader of the Pack.',
  },
  {
    id: 'leader_of_the_pack',
    name: 'Leader of the Pack',
    class: 'druid',
    effect: 'Melee / ranged crit',
    scope: 'raid',
    slot: 'form',
    talent: true,
    source: october15,
    note: 'Requires the talent and an appropriate feral form.',
  },
  {
    id: 'mark_of_the_wild',
    name: 'Mark of the Wild',
    class: 'druid',
    effect: 'Stats / armor / resistances',
    scope: 'raid',
    source: client('druid', 'mark-of-the-wild'),
    note: 'Castable on each raid member; not an aura.',
  },
  {
    id: 'trueshot_aura',
    name: 'Trueshot Aura',
    class: 'hunter',
    effect: 'Attack power aura',
    scope: 'raid',
    talent: true,
    source: october15,
  },
  {
    id: 'arcane_intellect',
    name: 'Arcane Intellect',
    class: 'mage',
    effect: 'Intellect',
    scope: 'raid',
    source: client('mage', 'arcane-intellect'),
    note: 'Castable on each raid member.',
  },
  {
    id: 'fortitude',
    name: 'Power Word: Fortitude',
    class: 'priest',
    effect: 'Stamina',
    scope: 'raid',
    source: client('priest', 'power-word-fortitude'),
    note: 'Castable on each raid member.',
  },
  {
    id: 'divine_spirit',
    name: 'Divine Spirit',
    class: 'priest',
    effect: 'Spirit',
    scope: 'raid',
    source: 'https://worldofwarcraft.blizzard.com/en-us/news/24301514',
    note: 'Baseline in Forever; castable across the raid.',
  },
  {
    id: 'battle_shout',
    name: 'Battle Shout',
    class: 'warrior',
    effect: 'Attack power shout',
    scope: 'raid',
    source: october15,
  },
  {
    id: 'windfury_totem',
    name: 'Windfury Totem',
    class: 'shaman',
    effect: 'Extra melee attacks',
    scope: 'raid',
    slot: 'air',
    conflictsWith: ['flametongue_totem'],
    source: october15,
    note: 'Exclusive with Flametongue. Can coexist with Grace of Air from another Shaman.',
  },
  {
    id: 'grace_of_air',
    name: 'Grace of Air Totem',
    class: 'shaman',
    effect: 'Agility',
    scope: 'raid',
    slot: 'air',
    source: october15,
  },
  {
    id: 'strength_of_earth',
    name: 'Strength of Earth Totem',
    class: 'shaman',
    effect: 'Strength',
    scope: 'raid',
    slot: 'earth',
    source: october15,
  },
  {
    id: 'flametongue_totem',
    name: 'Flametongue Totem',
    class: 'shaman',
    effect: 'Fire weapon damage',
    scope: 'raid',
    slot: 'fire',
    conflictsWith: ['windfury_totem'],
    source: october15,
  },
  {
    id: 'mana_spring',
    name: 'Mana Spring Totem',
    class: 'shaman',
    effect: 'Mana regeneration',
    scope: 'party',
    slot: 'water',
    source: client('shaman', 'mana-spring-totem'),
  },
  {
    id: 'healing_stream',
    name: 'Healing Stream Totem',
    class: 'shaman',
    effect: 'Periodic healing',
    scope: 'party',
    slot: 'water',
    source: client('shaman', 'healing-stream-totem'),
  },
  {
    id: 'stoneskin',
    name: 'Stoneskin Totem',
    class: 'shaman',
    effect: 'Physical damage reduction',
    scope: 'party',
    slot: 'earth',
    source: client('shaman', 'stoneskin-totem'),
  },
  {
    id: 'fire_resistance_totem',
    name: 'Fire Resistance Totem',
    class: 'shaman',
    effect: 'Fire resistance',
    scope: 'raid',
    slot: 'water',
    source: 'https://worldofwarcraft.blizzard.com/en-us/news/24302097',
  },
  {
    id: 'frost_resistance_totem',
    name: 'Frost Resistance Totem',
    class: 'shaman',
    effect: 'Frost resistance',
    scope: 'raid',
    slot: 'fire',
    source: 'https://worldofwarcraft.blizzard.com/en-us/news/24302097',
  },
  {
    id: 'nature_resistance_totem',
    name: 'Nature Resistance Totem',
    class: 'shaman',
    effect: 'Nature resistance',
    scope: 'raid',
    slot: 'air',
    source: 'https://worldofwarcraft.blizzard.com/en-us/news/24302097',
  },
  {
    id: 'devotion_aura',
    name: 'Devotion Aura',
    class: 'paladin',
    effect: 'Armor aura',
    scope: 'party',
    slot: 'aura',
    source: client('paladin', 'devotion-aura'),
  },
  {
    id: 'concentration_aura',
    name: 'Concentration Aura',
    class: 'paladin',
    effect: 'Spell pushback protection',
    scope: 'party',
    slot: 'aura',
    source: client('paladin', 'concentration-aura'),
  },
  {
    id: 'fire_resistance_aura',
    name: 'Fire Resistance Aura',
    class: 'paladin',
    effect: 'Fire resistance',
    scope: 'raid',
    slot: 'aura',
    source: paladinPreview,
  },
  {
    id: 'frost_resistance_aura',
    name: 'Frost Resistance Aura',
    class: 'paladin',
    effect: 'Frost resistance',
    scope: 'raid',
    slot: 'aura',
    source: paladinPreview,
  },
  {
    id: 'shadow_resistance_aura',
    name: 'Shadow Resistance Aura',
    class: 'paladin',
    effect: 'Shadow resistance',
    scope: 'raid',
    slot: 'aura',
    source: paladinPreview,
  },
  {
    id: 'blessing_of_kings',
    name: 'Blessing of Kings',
    class: 'paladin',
    effect: 'Attribute multiplier',
    scope: 'raid',
    slot: 'blessing',
    source: paladinPreview,
    note: 'One assigned raid-wide blessing per Paladin. Individual target choices can differ in game.',
  },
  {
    id: 'blessing_of_might',
    name: 'Blessing of Might',
    class: 'paladin',
    effect: 'Attack power blessing',
    scope: 'raid',
    slot: 'blessing',
    source: client('paladin', 'blessing-of-might'),
  },
  {
    id: 'blessing_of_wisdom',
    name: 'Blessing of Wisdom',
    class: 'paladin',
    effect: 'Mana regeneration blessing',
    scope: 'raid',
    slot: 'blessing',
    source: client('paladin', 'blessing-of-wisdom'),
  },
  ...additionalAbilities,
];
export const categoryOf = (ability: BuffDefinition): AbilityCategory => ability.category || 'buff';
export const petsFor = (cls: CharacterClass) => [
  ...new Set(buffs.filter((b) => b.class === cls && b.pet).map((b) => b.pet!)),
];
export interface SpecPreset {
  id: string;
  name: string;
  role: Role;
  buffs: string[];
}
const preset = (id: string, name: string, role: Role, selected: string[] = []): SpecPreset => ({
  id,
  name,
  role,
  buffs: selected,
});
const priest = ['fortitude', 'divine_spirit'];
const shaman = ['strength_of_earth', 'windfury_totem', 'mana_spring'];
const paladin = ['blessing_of_kings', 'devotion_aura'];
export const specs: Record<CharacterClass, SpecPreset[]> = {
  druid: [
    preset('balance', 'Balance', 'ranged', ['mark_of_the_wild', 'moonkin_aura']),
    preset('feral', 'Feral', 'melee', ['mark_of_the_wild', 'leader_of_the_pack']),
    preset('feral_tank', 'Feral tank', 'tank', ['mark_of_the_wild', 'leader_of_the_pack']),
    preset('restoration', 'Restoration', 'healer', ['mark_of_the_wild']),
  ],
  hunter: [
    preset('beast_mastery', 'Beast Mastery', 'ranged'),
    preset('marksmanship', 'Marksmanship', 'ranged', ['trueshot_aura']),
    preset('survival', 'Survival', 'melee'),
  ],
  mage: [
    preset('arcane', 'Arcane', 'ranged', ['arcane_intellect']),
    preset('fire', 'Fire', 'ranged', ['arcane_intellect']),
    preset('frost', 'Frost', 'ranged', ['arcane_intellect']),
  ],
  paladin: [
    preset('holy', 'Holy', 'healer', paladin),
    preset('protection', 'Protection', 'tank', paladin),
    preset('retribution', 'Retribution', 'melee', paladin),
  ],
  priest: [
    preset('discipline', 'Discipline', 'healer', priest),
    preset('holy', 'Holy', 'healer', priest),
    preset('shadow', 'Shadow', 'ranged', priest),
  ],
  rogue: [
    preset('assassination', 'Assassination', 'melee'),
    preset('combat', 'Combat', 'melee'),
    preset('subtlety', 'Subtlety', 'melee'),
  ],
  shaman: [
    preset('elemental', 'Elemental', 'ranged', shaman),
    preset('enhancement', 'Enhancement', 'melee', shaman),
    preset('restoration', 'Restoration', 'healer', [
      'strength_of_earth',
      'grace_of_air',
      'mana_spring',
    ]),
  ],
  warlock: [
    preset('affliction', 'Affliction', 'ranged'),
    preset('demonology', 'Demonology', 'ranged'),
    preset('destruction', 'Destruction', 'ranged'),
  ],
  warrior: [
    preset('arms', 'Arms', 'melee', ['battle_shout']),
    preset('fury', 'Fury', 'melee', ['battle_shout']),
    preset('protection', 'Protection', 'tank', ['battle_shout']),
  ],
};
for (const [cls, presets] of Object.entries(specs))
  for (const spec of presets)
    spec.buffs = [
      ...new Set([
        ...spec.buffs,
        ...baselineAbilities[cls as CharacterClass],
        ...(specAbilities[cls + ':' + spec.id] || []),
      ]),
    ];
export const specFor = (cls: CharacterClass, id: string) => specs[cls].find((s) => s.id === id);
export function loadoutIssues(cls: CharacterClass, selected: string[]): string[] {
  const errors: string[] = [],
    slots = new Set<string>();
  if (new Set(selected).size !== selected.length)
    errors.push('Each buff can be selected only once.');
  for (const id of selected) {
    const buff = buffs.find((b) => b.id === id);
    if (!buff || buff.class !== cls) {
      errors.push('Choose buffs belonging to this class.');
      continue;
    }
    if (buff.slot) {
      if (slots.has(buff.slot))
        errors.push(
          `Choose only one ${['aura', 'blessing', 'form', 'curse', 'sting', 'judgement'].includes(buff.slot) ? buff.slot : buff.slot + ' totem'} per character.`,
        );
      slots.add(buff.slot);
    }
    if (buff.conflictsWith?.some((other) => selected.includes(other)))
      errors.push('Windfury and Flametongue cannot be active together.');
  }
  if (
    new Set(
      selected.flatMap((id) => {
        const pet = buffs.find((b) => b.id === id)?.pet;
        return pet ? [pet] : [];
      }),
    ).size > 1
  )
    errors.push('Choose one active pet per character.');
  return [...new Set(errors)];
}
