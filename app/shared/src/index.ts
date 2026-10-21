import { z } from 'zod';
export type {
  ProfessionTier,
  ProfessionSnapshot,
  DirectoryCharacter,
  DirectoryRecipe,
  ProfessionDirectory,
  RecipeCoverage,
  RecipeMaterials,
} from './professions.js';
import { buffs, specs, specFor, loadoutIssues } from './buffs.js';
export {
  buffs,
  specs,
  specFor,
  loadoutIssues,
  baselineAbilities,
  abilityCategories,
  categoryOf,
  petsFor,
  excludedRaidEffects,
} from './buffs.js';
export type { BuffDefinition, SpecPreset, AbilityCategory } from './buffs.js';
export { composition } from './composition.js';

export const rulesets = ['normal', 'pvp', 'roleplaying'] as const;
export const factions = ['alliance', 'horde'] as const;
export const regions = ['us', 'eu', 'kr', 'tw'] as const;
export const roles = ['tank', 'healer', 'melee', 'ranged'] as const;
export type Role = (typeof roles)[number];
export const classes = [
  'druid',
  'hunter',
  'mage',
  'paladin',
  'priest',
  'rogue',
  'shaman',
  'warlock',
  'warrior',
] as const;
export type CharacterClass = (typeof classes)[number];
export const classColors: Record<CharacterClass, string> = {
  druid: '#ed9a57',
  hunter: '#a4c77f',
  mage: '#82cbd9',
  paladin: '#df9ec1',
  priest: '#dddcd4',
  rogue: '#e2cf79',
  shaman: '#75a9df',
  warlock: '#b5a3e3',
  warrior: '#c4a37d',
};
export const classRoles: Record<CharacterClass, Role[]> = {
  druid: ['tank', 'healer', 'melee', 'ranged'],
  hunter: ['melee', 'ranged'],
  mage: ['ranged'],
  paladin: ['tank', 'healer', 'melee'],
  priest: ['healer', 'ranged'],
  rogue: ['melee'],
  shaman: ['healer', 'melee', 'ranged'],
  warlock: ['ranged'],
  warrior: ['tank', 'melee'],
};
export const races: Record<(typeof factions)[number], Record<string, readonly CharacterClass[]>> = {
  alliance: {
    human: ['hunter', 'mage', 'paladin', 'priest', 'rogue', 'warlock', 'warrior'],
    dwarf: ['hunter', 'paladin', 'priest', 'rogue', 'shaman', 'warrior'],
    gnome: ['mage', 'priest', 'rogue', 'warlock', 'warrior'],
    night_elf: ['druid', 'hunter', 'priest', 'rogue', 'warrior'],
    skyborne: ['druid', 'hunter', 'mage', 'rogue', 'warrior'],
  },
  horde: {
    orc: ['hunter', 'mage', 'rogue', 'shaman', 'warlock', 'warrior'],
    tauren: ['druid', 'hunter', 'shaman', 'warrior'],
    troll: ['hunter', 'mage', 'priest', 'rogue', 'shaman', 'warlock', 'warrior'],
    undead: ['mage', 'paladin', 'priest', 'rogue', 'warlock', 'warrior'],
    skyborne: ['druid', 'hunter', 'rogue', 'shaman', 'warrior'],
  },
};
export const catalog = {
  version: 'forever-1.60.1.70450-reviewed-2026-10-20',
  reviewedAt: '2026-10-20',
  sources: [
    {
      label: 'Hunter and Druid preview',
      url: 'https://news.blizzard.com/en-us/article/24301515/world-of-warcraft-forever-class-deep-dives-hunter-and-druid',
    },
    {
      label: 'Rogue and Warlock preview',
      url: 'https://news.blizzard.com/en-us/article/24310968/world-of-warcraft-forever-class-deep-dives-rogue-and-warlock',
    },
    {
      label: 'Hunter pet abilities (extracted client data)',
      url: 'https://theforeverera.com/en/hunter-pets/',
    },
    {
      label: 'October 15 beta changes (supersedes class previews)',
      url: 'https://us.forums.blizzard.com/en/wow/t/wow-forever-beta-development-notes-%E2%80%93-updated-october-15/2360696/6',
    },
    { label: 'Paladin preview', url: 'https://worldofwarcraft.blizzard.com/en-us/news/24302099' },
    {
      label: 'Priest and Warrior preview',
      url: 'https://worldofwarcraft.blizzard.com/en-us/news/24301514',
    },
    {
      label: 'Mage and Shaman preview',
      url: 'https://worldofwarcraft.blizzard.com/en-us/news/24302097',
    },
    {
      label: 'Extracted Forever client spellbook (older tooltips may lag patch notes)',
      url: 'https://theforeverera.com/en/spells/',
    },
  ],
  buffs,
  specs,
};
export const label = (value: string) =>
  value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const text = (max: number) => z.string().trim().max(max);
export const idSchema = z.uuid();
export const workspaceSchema = z
  .object({
    name: text(80).min(2),
    region: z.enum(regions),
    ruleset: z.enum(rulesets),
    faction: z.enum(factions),
  })
  .strict();
export type WorkspaceInput = z.infer<typeof workspaceSchema>;
export const characterSchema = z
  .object({
    name: text(60).min(1),
    class: z.enum(classes),
    spec: text(30).default('custom'),
    role: z.enum(roles),
    buffs: z.array(z.string().max(60)).max(120).default([]),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.spec !== 'custom' && !specFor(c.class, c.spec))
      ctx.addIssue({
        code: 'custom',
        path: ['spec'],
        message: 'Choose a spec belonging to this class.',
      });
    if (!classRoles[c.class].includes(c.role))
      ctx.addIssue({
        code: 'custom',
        path: ['role'],
        message: 'Choose a supported role for this class.',
      });
    for (const message of loadoutIssues(c.class, c.buffs))
      ctx.addIssue({ code: 'custom', path: ['buffs'], message });
  });
export type CharacterInput = z.infer<typeof characterSchema>;
export const raidSizes = [10, 20, 40] as const;
export const planSchema = z
  .object({
    name: text(80).min(1),
    capacity: z
      .number()
      .int()
      .refine(
        (capacity) => raidSizes.some((size) => size === capacity),
        'Choose a 10, 20, or 40-man raid.',
      ),
    notes: text(2000).default(''),
  })
  .strict();
export type PlanInput = z.infer<typeof planSchema>;
export const assignmentSchema = z
  .object({
    characterId: idSchema,
    status: z.enum(['lineup', 'bench']),
    group: z.number().int().min(1).max(8).nullable().default(null),
    slot: z.number().int().min(1).max(5).nullable().optional(),
  })
  .strict();
export type AssignmentInput = z.infer<typeof assignmentSchema>;
export interface Workspace extends WorkspaceInput {
  id: string;
  role: 'owner';
}
export interface Session {
  user: { id: string; username: string } | null;
  csrfToken?: string;
  workspaces: Workspace[];
}
export interface Character extends CharacterInput {
  id: string;
  archived: boolean;
  revision: number;
  updatedAt: string;
}
export interface Assignment extends AssignmentInput {
  id: string;
}
export interface Plan extends PlanInput {
  id: string;
  revision: number;
  updatedAt: string;
  assignments: Assignment[];
}
export interface Snapshot {
  workspace: Workspace;
  characters: Character[];
  plans: Plan[];
}
// Portable snapshots contain only this composition's characters and placements.
export const sharedRaidSchema = z
  .object({
    version: z.literal(1),
    catalogVersion: z.string().max(100),
    name: z.string().trim().min(1).max(80),
    capacity: planSchema.shape.capacity,
    characters: z.array(characterSchema).max(80),
    placements: z
      .array(
        z
          .object({
            character: z.number().int().min(0).max(79),
            status: assignmentSchema.shape.status,
            group: assignmentSchema.shape.group,
            slot: assignmentSchema.shape.slot,
          })
          .strict(),
      )
      .max(80),
  })
  .strict()
  .superRefine((s, ctx) => {
    const assigned = new Set<number>(),
      positions = new Set<string>();
    let active = 0;
    for (const p of s.placements) {
      if (p.character >= s.characters.length || assigned.has(p.character))
        ctx.addIssue({ code: 'custom', message: 'Invalid or duplicate character placement.' });
      assigned.add(p.character);
      if (p.status === 'bench' && (p.group !== null || p.slot != null))
        ctx.addIssue({ code: 'custom', message: 'Bench characters cannot occupy raid slots.' });
      if (p.status === 'lineup') {
        active++;
        if (p.group !== null) {
          if (p.group > s.capacity / 5 || p.slot == null)
            ctx.addIssue({ code: 'custom', message: 'Invalid raid slot.' });
          const key = p.group + ':' + p.slot;
          if (positions.has(key)) ctx.addIssue({ code: 'custom', message: 'Duplicate raid slot.' });
          positions.add(key);
        } else if (p.slot != null)
          ctx.addIssue({ code: 'custom', message: 'A slot requires a group.' });
      }
    }
    if (active > s.capacity || assigned.size !== s.characters.length)
      ctx.addIssue({ code: 'custom', message: 'Invalid raid size or unplaced character.' });
  });
export type SharedRaid = z.infer<typeof sharedRaidSchema>;
export function makeSharedRaid(plan: Plan, characters: Character[]): SharedRaid {
  const assigned = plan.assignments
    .map((a) => ({ a, c: characters.find((c) => c.id === a.characterId) }))
    .filter((x): x is { a: Assignment; c: Character } => Boolean(x.c));
  return sharedRaidSchema.parse({
    version: 1,
    catalogVersion: catalog.version,
    name: plan.name,
    capacity: plan.capacity,
    characters: assigned.map(({ c }) => ({
      name: c.name,
      class: c.class,
      spec: c.spec,
      role: c.role,
      buffs: c.buffs,
    })),
    placements: assigned.map(({ a }, character) => ({
      character,
      status: a.status,
      group: a.status === 'bench' ? null : a.group,
      slot: a.status === 'bench' ? null : (a.slot ?? null),
    })),
  });
}
export function expandSharedRaid(snapshot: SharedRaid): { plan: Plan; characters: Character[] } {
  return {
    plan: {
      id: 'shared',
      name: snapshot.name,
      capacity: snapshot.capacity,
      notes: '',
      revision: 1,
      updatedAt: '',
      assignments: snapshot.placements.map((p) => ({
        id: String(p.character),
        characterId: String(p.character),
        status: p.status,
        group: p.group,
        slot: p.slot,
      })),
    },
    characters: snapshot.characters.map((c, i) => ({
      ...c,
      id: String(i),
      archived: false,
      revision: 1,
      updatedAt: '',
    })),
  };
}
export const csvHeaders = ['name', 'class', 'spec', 'role', 'buffs'] as const;
// RFC 4180-style quoted fields; bounded by the API body limit and import row cap.
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false,
    closed = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else field += c;
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field);
      field = '';
      closed = false;
      if (c !== ',') {
        if (c === '\r' && input[i + 1] === '\n') i++;
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
      }
    } else {
      if (closed || c === '"') throw new Error('Malformed CSV quoting.');
      field += c;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  if (field || row.length) {
    row.push(field);
    if (row.some((v) => v.trim())) rows.push(row);
  }
  return rows;
}
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[\s]*[=+@\-\t\r]/.test(s)) s = `'${s}`; // Prevent spreadsheet formula execution.
  return `"${s.replaceAll('"', '""')}"`;
}
