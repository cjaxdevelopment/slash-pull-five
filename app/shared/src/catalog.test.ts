import { describe, expect, it } from 'vitest';
import {
  buffs,
  categoryOf,
  baselineAbilities,
  makeSharedRaid,
  sharedRaidSchema,
  expandSharedRaid,
  classes,
  characterSchema,
  composition,
  csvCell,
  loadoutIssues,
  parseCsv,
  specs,
  type Character,
  type Plan,
  type CharacterClass,
} from './index.js';
function character(
  id: string,
  cls: CharacterClass,
  selected: string[],
  role = specs[cls][0].role,
): Character {
  return {
    id,
    name: id,
    class: cls,
    spec: 'custom',
    role,
    buffs: selected,
    archived: false,
    revision: 1,
    updatedAt: '',
  };
}
function plan(
  rows: [string, number | null, ('lineup' | 'bench')?][],
  capacity = 10,
): Pick<Plan, 'capacity' | 'assignments'> {
  return {
    capacity,
    assignments: rows.map(([characterId, group, status = 'lineup'], i) => ({
      id: String(i),
      characterId,
      group,
      status,
    })),
  };
}
const effect = (p: ReturnType<typeof composition>, name: string) =>
  p.rows.find((r) => r.effect === name)!;
describe('Forever loadouts', () => {
  it('keeps every spec preset valid and sourced', () => {
    for (const cls of classes)
      for (const spec of specs[cls])
        expect(
          characterSchema.safeParse({
            name: 'Example',
            class: cls,
            spec: spec.id,
            role: spec.role,
            buffs: spec.buffs,
          }).success,
        ).toBe(true);
    expect(buffs.every((b) => b.source.startsWith('https://'))).toBe(true);
  });
  it('rejects foreign buffs, duplicate buffs, simultaneous forms and one-element totem conflicts', () => {
    expect(loadoutIssues('warrior', ['moonkin_aura'])).not.toEqual([]);
    expect(loadoutIssues('warrior', ['battle_shout', 'battle_shout'])).not.toEqual([]);
    expect(loadoutIssues('druid', ['moonkin_aura', 'leader_of_the_pack'])).not.toEqual([]);
    expect(loadoutIssues('shaman', ['windfury_totem', 'grace_of_air'])).not.toEqual([]);
    expect(loadoutIssues('shaman', ['windfury_totem', 'flametongue_totem'])).not.toEqual([]);
    expect(loadoutIssues('paladin', ['devotion_aura', 'concentration_aura'])).not.toEqual([]);
    expect(loadoutIssues('paladin', ['blessing_of_kings', 'blessing_of_might'])).not.toEqual([]);
  });
  it('allows compatible loadouts and explicit custom builds', () => {
    expect(
      loadoutIssues('shaman', [
        'strength_of_earth',
        'grace_of_air',
        'flametongue_totem',
        'mana_spring',
      ]),
    ).toEqual([]);
    expect(
      characterSchema.safeParse({
        name: 'Hybrid',
        class: 'druid',
        spec: 'custom',
        role: 'healer',
        buffs: ['leader_of_the_pack'],
      }).success,
    ).toBe(true);
    expect(
      characterSchema.safeParse({
        name: 'Wrong',
        class: 'mage',
        spec: 'protection',
        role: 'tank',
        buffs: [],
      }).success,
    ).toBe(false);
  });
});
describe('buff coverage', () => {
  it('counts the two crit auras independently across the whole raid', () => {
    const chars = [
      character('Balance', 'druid', ['moonkin_aura']),
      character('Feral', 'druid', ['leader_of_the_pack']),
      character('Tank', 'warrior', []),
    ];
    const comp = composition(
      plan([
        ['Balance', 1],
        ['Feral', 1],
        ['Tank', 2],
      ]),
      chars,
    );
    expect(effect(comp, 'Spell crit').recipients).toHaveLength(3);
    expect(effect(comp, 'Melee / ranged crit').recipients).toHaveLength(3);
    expect(comp.counts).toMatchObject({ ranged: 2, melee: 1 });
  });
  it('treats October 15 totems as raid-wide and permits Windfury with Grace of Air from a second Shaman', () => {
    const chars = [
      character('Wind', 'shaman', ['windfury_totem', 'strength_of_earth']),
      character('Grace', 'shaman', ['grace_of_air']),
      character('Tank', 'warrior', []),
    ];
    const comp = composition(
      plan([
        ['Wind', 1],
        ['Grace', 2],
        ['Tank', 2],
      ]),
      chars,
    );
    for (const name of ['Extra melee attacks', 'Strength', 'Agility'])
      expect(effect(comp, name).status).toBe('covered');
    expect(comp.conflicts).toHaveLength(0);
  });
  it('limits party totems and auras to the assigned group', () => {
    const chars = [
      character('Water', 'shaman', ['mana_spring']),
      character('Paladin', 'paladin', ['devotion_aura']),
      character('Tank', 'warrior', []),
    ];
    const comp = composition(
      plan([
        ['Water', 1],
        ['Paladin', 1],
        ['Tank', 2],
      ]),
      chars,
    );
    expect(effect(comp, 'Mana regeneration')).toMatchObject({
      status: 'partial',
      recipients: ['Water', 'Paladin'],
      groups: [
        { group: 1, covered: 2, total: 2 },
        { group: 2, covered: 0, total: 1 },
      ],
    });
    expect(effect(comp, 'Armor aura').recipients).toEqual(['Water', 'Paladin']);
  });
  it('updates party coverage when characters move groups', () => {
    const chars = [character('Water', 'shaman', ['mana_spring']), character('Tank', 'warrior', [])];
    expect(
      effect(
        composition(
          plan([
            ['Water', 1],
            ['Tank', 1],
          ]),
          chars,
        ),
        'Mana regeneration',
      ).status,
    ).toBe('covered');
    expect(
      effect(
        composition(
          plan([
            ['Water', 1],
            ['Tank', 2],
          ]),
          chars,
        ),
        'Mana regeneration',
      ).status,
    ).toBe('partial');
  });
  it('does not count benched providers or assign party coverage to ungrouped characters', () => {
    const chars = [
      character('Water', 'shaman', ['mana_spring', 'windfury_totem']),
      character('Tank', 'warrior', []),
    ];
    const benched = composition(
      plan([
        ['Water', 1, 'bench'],
        ['Tank', 2],
      ]),
      chars,
    );
    expect(benched.total).toBe(1);
    expect(effect(benched, 'Extra melee attacks').status).toBe('missing');
    const ungrouped = composition(
      plan([
        ['Water', null],
        ['Tank', null],
      ]),
      chars,
    );
    expect(ungrouped.ungrouped).toBe(2);
    expect(effect(ungrouped, 'Mana regeneration').recipients).toEqual([]);
    expect(effect(ungrouped, 'Extra melee attacks').recipients).toHaveLength(2);
  });
  it('flags Windfury and Flametongue across different providers without counting both', () => {
    const chars = [
      character('Wind', 'shaman', ['windfury_totem']),
      character('Flame', 'shaman', ['flametongue_totem']),
    ];
    const comp = composition(
      plan([
        ['Wind', 1],
        ['Flame', 2],
      ]),
      chars,
    );
    expect(comp.conflicts).toHaveLength(2);
    expect(comp.conflicts.every((r) => r.recipients.length === 0)).toBe(true);
    expect(
      composition(
        plan([
          ['Wind', 1],
          ['Flame', 2, 'bench'],
        ]),
        chars,
      ).conflicts,
    ).toHaveLength(0);
  });
  it('combines alternate resistance providers without counting recipients twice', () => {
    const chars = [
      character('Shaman', 'shaman', ['fire_resistance_totem']),
      character('Paladin', 'paladin', ['fire_resistance_aura']),
    ];
    const row = effect(
      composition(
        plan([
          ['Shaman', 1],
          ['Paladin', 2],
        ]),
        chars,
      ),
      'Fire resistance',
    );
    expect(row.providers).toHaveLength(2);
    expect(row.recipients).toHaveLength(2);
    expect(row.status).toBe('covered');
  });
  it('does not infer buffs from class alone or invent a raid Bloodlust', () => {
    const comp = composition(plan([['Shaman', 1]]), [character('Shaman', 'shaman', [])]);
    expect(comp.rows.every((r) => r.status === 'missing')).toBe(true);
    expect(buffs.some((b) => /bloodlust/i.test(b.id))).toBe(false);
  });
});
describe('character CSV', () => {
  it('parses quotes and newlines and rejects malformed quoting', () => {
    expect(parseCsv('a,b\r\n"c,d","say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['c,d', 'say "hi"'],
    ]);
    expect(parseCsv('"line\nbreak",x')).toEqual([['line\nbreak', 'x']]);
    expect(() => parseCsv('"unclosed')).toThrow();
    expect(() => parseCsv('"closed"bad,x')).toThrow();
    expect(csvCell('  =SUM(A1)')).toBe('"\'  =SUM(A1)"');
  });
});

describe('expanded Forever support', () => {
  it('separates group buffs, enemy debuffs and utility availability', () => {
    const chars = [character('Lock', 'warlock', ['curse_of_elements', 'banish', 'seduction'])];
    const comp = composition(plan([['Lock', 1]]), chars);
    expect(effect(comp, 'Magic damage vulnerability')).toMatchObject({
      category: 'debuff',
      availabilityOnly: true,
      providerCount: 1,
      status: 'covered',
      recipients: [],
    });
    expect(effect(comp, 'Crowd control')).toMatchObject({
      category: 'utility',
      availabilityOnly: true,
      providerCount: 1,
      status: 'covered',
      groups: [{ providers: 1 }, { providers: 0 }],
    });
    expect(effect(comp, 'Magic damage vulnerability').category).toBe('debuff');
  });
  it('requires one active pet and one maintained curse or judgement', () => {
    expect(loadoutIssues('warlock', ['blood_pact', 'spell_lock'])).toContain(
      'Choose one active pet per character.',
    );
    expect(loadoutIssues('warlock', ['spell_lock', 'devour_magic', 'curse_of_elements'])).toEqual(
      [],
    );
    expect(loadoutIssues('warlock', ['curse_of_elements', 'curse_of_recklessness'])).not.toEqual(
      [],
    );
    expect(loadoutIssues('paladin', ['judgement_of_light', 'judgement_of_wisdom'])).not.toEqual([]);
  });
  it('limits Imp coverage to its group while tracking Wolf coverage raid-wide', () => {
    const chars = [
      character('Imp', 'warlock', ['blood_pact']),
      character('Wolf', 'hunter', ['furious_howl']),
      character('Tank', 'warrior', []),
    ];
    const comp = composition(
      plan([
        ['Imp', 1],
        ['Wolf', 2],
        ['Tank', 2],
      ]),
      chars,
    );
    expect(effect(comp, 'Stamina (Imp)')).toMatchObject({ status: 'partial', recipients: ['Imp'] });
    expect(effect(comp, 'Melee attack power (Wolf)').recipients).toHaveLength(3);
    expect(
      effect(
        composition(
          plan([
            ['Imp', 1, 'bench'],
            ['Tank', 2],
          ]),
          chars,
        ),
        'Stamina (Imp)',
      ).status,
    ).toBe('missing');
  });
  it('excludes personal vulnerabilities, removed talents and raid Bloodlust', () => {
    for (const name of [
      'Improved Scorch',
      "Winter's Chill",
      'Shadow Weaving',
      'Improved Shadow Bolt',
      'Hemorrhage',
      'Improved Mark of the Wild',
      'Improved Battle Shout',
      'Bloodlust',
    ])
      expect(buffs.some((b) => b.name === name)).toBe(false);
    expect(buffs.some((b) => b.name === 'Rage of the Farseer')).toBe(false);
  });
  it('has valid baseline abilities and category metadata for all nine classes', () => {
    for (const cls of classes)
      for (const id of baselineAbilities[cls]) {
        const ability = buffs.find((b) => b.id === id)!;
        expect(ability.class).toBe(cls);
        expect(ability.talent).not.toBe(true);
        expect(ability.pet).toBeUndefined();
        expect(['buff', 'debuff', 'utility']).toContain(categoryOf(ability));
      }
  });
});
describe('portable composition snapshots', () => {
  const c = { ...character('private-character-id', 'warrior', ['battle_shout']), name: 'Arden' };
  const p: Plan = {
    id: 'private-plan-id',
    name: 'Shared raid',
    capacity: 10,
    notes: 'Private notes',
    revision: 1,
    updatedAt: '',
    assignments: [
      { id: 'private-assignment-id', characterId: c.id, status: 'lineup', group: 1, slot: 3 },
    ],
  };
  it('shares only placed characters and loadouts, never workspace IDs or notes', () => {
    const snapshot = makeSharedRaid(p, [c, character('Not placed', 'mage', [])]);
    expect(snapshot.characters).toHaveLength(1);
    expect(JSON.stringify(snapshot)).not.toContain('private-');
    expect(snapshot).not.toHaveProperty('notes');
    const expanded = expandSharedRaid(snapshot);
    expect(expanded.plan.assignments[0]).toMatchObject({ group: 1, slot: 3 });
    expect(composition(expanded.plan, expanded.characters).total).toBe(1);
  });
  it('rejects invalid slots, duplicate placements, foreign buffs and oversized snapshots', () => {
    const snapshot = makeSharedRaid(p, [c]);
    expect(
      sharedRaidSchema.safeParse({
        ...snapshot,
        placements: [snapshot.placements[0], snapshot.placements[0]],
      }).success,
    ).toBe(false);
    expect(
      sharedRaidSchema.safeParse({
        ...snapshot,
        placements: [{ ...snapshot.placements[0], slot: 6 }],
      }).success,
    ).toBe(false);
    expect(
      sharedRaidSchema.safeParse({
        ...snapshot,
        characters: [{ ...snapshot.characters[0], buffs: ['moonkin_aura'] }],
      }).success,
    ).toBe(false);
    expect(
      sharedRaidSchema.safeParse({
        ...snapshot,
        characters: Array.from({ length: 81 }, () => snapshot.characters[0]),
      }).success,
    ).toBe(false);
  });
});
