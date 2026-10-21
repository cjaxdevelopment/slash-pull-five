import './config.js';
import { z } from 'zod';
import type { ProfessionSnapshot, ProfessionTier } from '@spf/shared';

const positiveId = z.number().int().positive().safe();
const named = z.object({ id: positiveId, name: z.string().min(1).max(300) });
const realm = z.object({ slug: z.string().min(1).max(100) });
const characterSchema = named.extend({
  realm,
  character_class: z.object({ id: positiveId }).optional(),
  playable_class: z.object({ id: positiveId }).optional(),
});
const tierSchema = z.object({
  tier: named,
  skill_points: z.number().nonnegative().optional(),
  max_skill_points: z.number().nonnegative().optional(),
  known_recipes: z.array(named).max(30000).optional(),
});
const professionSchema = z.object({
  profession: named,
  tiers: z.array(tierSchema).max(100).optional(),
  skill_points: z.number().nonnegative().optional(),
  max_skill_points: z.number().nonnegative().optional(),
  known_recipes: z.array(named).max(30000).optional(),
});
const professionsSchema = z
  .object({
    character: z.object({ id: positiveId }),
    primaries: z.array(professionSchema).max(20).optional(),
    secondaries: z.array(professionSchema).max(20).optional(),
  })
  .refine((p) => p.primaries !== undefined || p.secondaries !== undefined);

export interface BlizzardSettings {
  autoRefresh: boolean;
  refreshIntervalMinutes: number;
  gameVersion: string;
  region: 'us' | 'eu' | 'kr' | 'tw';
  profileNamespace: string;
  dataNamespace: string;
  guild: string;
  guildRealm: string;
  guildSlug: string;
  clientId: string;
  clientSecret: string;
  admins: string[];
}
export function blizzardSettings(): BlizzardSettings {
  const region = z.enum(['us', 'eu', 'kr', 'tw']).parse(process.env.PROFS_REGION || 'us');
  const slug = z
    .string()
    .min(1)
    .max(100)
    .regex(/^[\p{L}\p{N}-]+$/u);
  return {
    autoRefresh: process.env.PROFS_AUTO_REFRESH !== 'false',
    refreshIntervalMinutes: z.coerce
      .number()
      .int()
      .min(15)
      .max(10080)
      .parse(process.env.PROFS_REFRESH_INTERVAL_MINUTES || 60),
    gameVersion: z
      .string()
      .regex(/^[a-z0-9-]{1,40}$/)
      .parse(process.env.PROFS_GAME_VERSION || 'retail'),
    region,
    profileNamespace: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .parse(process.env.PROFS_PROFILE_NAMESPACE || `profile-${region}`),
    dataNamespace: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .parse(process.env.PROFS_DATA_NAMESPACE || `static-${region}`),
    guild: 'Rewound',
    guildRealm: slug.parse(process.env.PROFS_GUILD_REALM || 'area-52'),
    guildSlug: slug.parse(process.env.PROFS_GUILD_SLUG || 'rewound'),
    clientId: process.env.BLIZZARD_CLIENT_ID || '',
    clientSecret: process.env.BLIZZARD_CLIENT_SECRET || '',
    admins: (process.env.PROFS_ADMIN_USERNAMES ?? 'eizzo')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  };
}
export const scopeId = (s: BlizzardSettings) => `${s.gameVersion}:${s.region}`;
export class BlizzardError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const malformed = () =>
  new BlizzardError(
    502,
    'Blizzard returned incomplete or unexpected data. Last successful data was kept.',
  );

export function normalizeProfessions(input: unknown, characterId: number): ProfessionSnapshot {
  const parsed = professionsSchema.safeParse(input);
  if (!parsed.success || parsed.data.character.id !== characterId) throw malformed();
  const tiers: ProfessionTier[] = [];
  for (const p of [...(parsed.data.primaries || []), ...(parsed.data.secondaries || [])]) {
    const rows = p.tiers?.length ? p.tiers : [{ ...p, tier: p.profession }];
    for (const tier of rows)
      tiers.push({
        professionId: p.profession.id,
        profession: p.profession.name,
        tierId: tier.tier.id,
        expansion: tier.tier.name,
        skill: tier.skill_points ?? null,
        maxSkill: tier.max_skill_points ?? null,
        recipesAvailable: tier.known_recipes !== undefined,
        recipes: (tier.known_recipes || []).map((r) => ({ id: r.id, name: r.name })),
      });
  }
  return { tiers };
}

export interface BlizzardSource {
  stop?(): void;
  configured: boolean;
  character(
    realm: string,
    name: string,
  ): Promise<{
    id: number;
    name: string;
    realm: string;
    classId?: number | null;
    snapshot: ProfessionSnapshot;
  }>;
  roster(): Promise<{
    guildId: number;
    characters: { id: number; name: string; realm: string; classId?: number | null }[];
  }>;
  recipe(id: number): Promise<{
    id: number;
    name: string;
    items: { id: number; name: string }[];
    iconUrl?: string | null;
    reagents?: { id: number; name: string; quantity: number | null }[] | null;
    modifiedReagents?: boolean;
  }>;
}
export class BlizzardClient implements BlizzardSource {
  private token?: { value: string; expires: number };
  private pendingToken?: Promise<string>;
  private shutdown = new AbortController();
  stop() {
    this.shutdown.abort();
  }
  get configured() {
    return (
      this.settings.gameVersion === 'retail' &&
      Boolean(this.settings.clientId && this.settings.clientSecret)
    );
  }
  constructor(
    private settings: BlizzardSettings,
    private fetcher: typeof fetch = fetch,
  ) {}
  private async json(url: string, init: RequestInit) {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.any([AbortSignal.timeout(15000), this.shutdown.signal]),
      });
    } catch {
      throw new BlizzardError(
        503,
        'Blizzard is temporarily unreachable. Last successful data was kept.',
      );
    }
    if (!response.ok)
      throw new BlizzardError(
        response.status,
        response.status === 404
          ? 'Blizzard data is unavailable (404). Last successful data was kept.'
          : response.status === 429
            ? 'Blizzard rate limit reached. Retry after the cooldown.'
            : 'Blizzard could not complete this request. Last successful data was kept.',
      );
    try {
      return (await response.json()) as unknown;
    } catch {
      throw malformed();
    }
  }
  private async accessToken() {
    if (this.settings.gameVersion !== 'retail')
      throw new BlizzardError(
        503,
        'Live imports are enabled only for retail until the target game’s Profile API and learned-recipe support are verified.',
      );
    if (!this.configured)
      throw new BlizzardError(503, 'Blizzard credentials must be configured on the server.');
    if (this.token && this.token.expires > Date.now()) return this.token.value;
    if (!this.pendingToken)
      this.pendingToken = (async () => {
        const data = await this.json('https://oauth.battle.net/token', {
          method: 'POST',
          headers: {
            Authorization:
              'Basic ' +
              Buffer.from(`${this.settings.clientId}:${this.settings.clientSecret}`).toString(
                'base64',
              ),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        });
        const result = z
          .object({ access_token: z.string().min(1), expires_in: z.number().positive() })
          .safeParse(data);
        if (!result.success) throw malformed();
        this.token = {
          value: result.data.access_token,
          expires: Date.now() + Math.max(0, result.data.expires_in - 60) * 1000,
        };
        return this.token.value;
      })().finally(() => {
        this.pendingToken = undefined;
      });
    return this.pendingToken;
  }
  private async get(path: string, namespace: string, retry = true): Promise<unknown> {
    const url = new URL(`https://${this.settings.region}.api.blizzard.com${path}`);
    url.searchParams.set('namespace', namespace);
    url.searchParams.set('locale', 'en_US');
    try {
      return await this.json(url.href, {
        headers: { Authorization: `Bearer ${await this.accessToken()}` },
      });
    } catch (e) {
      if (retry && e instanceof BlizzardError && e.status === 401) {
        this.token = undefined;
        return this.get(path, namespace, false);
      }
      throw e;
    }
  }
  async character(realmSlug: string, name: string) {
    const path = `/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(name.toLowerCase())}`;
    const parsed = characterSchema.safeParse(await this.get(path, this.settings.profileNamespace));
    if (
      !parsed.success ||
      parsed.data.realm.slug !== realmSlug ||
      parsed.data.name.toLowerCase() !== name.toLowerCase()
    )
      throw malformed();
    const snapshot = normalizeProfessions(
      await this.get(path + '/professions', this.settings.profileNamespace),
      parsed.data.id,
    );
    return {
      id: parsed.data.id,
      name: parsed.data.name,
      realm: parsed.data.realm.slug,
      classId: parsed.data.character_class?.id ?? null,
      snapshot,
    };
  }
  async roster() {
    const path = `/data/wow/guild/${encodeURIComponent(this.settings.guildRealm)}/${encodeURIComponent(this.settings.guildSlug)}`;
    const profile = named
      .extend({ realm })
      .safeParse(await this.get(path, this.settings.profileNamespace));
    if (
      !profile.success ||
      profile.data.name.toLowerCase() !== this.settings.guild.toLowerCase() ||
      profile.data.realm.slug !== this.settings.guildRealm
    )
      throw malformed();
    const roster = z
      .object({
        guild: named.extend({ realm }),
        members: z.array(z.object({ character: characterSchema })).max(1000),
      })
      .safeParse(await this.get(path + '/roster', this.settings.profileNamespace));
    if (
      !roster.success ||
      roster.data.guild.id !== profile.data.id ||
      roster.data.guild.realm.slug !== this.settings.guildRealm ||
      roster.data.guild.name.toLowerCase() !== this.settings.guild.toLowerCase()
    )
      throw malformed();
    return {
      guildId: profile.data.id,
      characters: roster.data.members.map(({ character: c }) => ({
        id: c.id,
        name: c.name,
        realm: c.realm.slug,
        classId: c.playable_class?.id ?? null,
      })),
    };
  }
  async recipe(id: number) {
    const parsed = named
      .extend({
        crafted_item: named.optional(),
        reagents: z
          .array(z.object({ reagent: named, quantity: z.number().int().nonnegative().optional() }))
          .max(100)
          .optional(),
        modified_crafting_slots: z.array(z.unknown()).max(100).optional(),
        media: z.object({ id: positiveId }).optional(),
        alliance_crafted_item: named.optional(),
        horde_crafted_item: named.optional(),
        crafted_items: z
          .array(z.union([named, z.object({ item: named })]))
          .max(100)
          .optional(),
      })
      .safeParse(await this.get(`/data/wow/recipe/${id}`, this.settings.dataNamespace));
    if (!parsed.success || parsed.data.id !== id) throw malformed();
    const r = parsed.data;
    const items = [
      r.crafted_item,
      r.alliance_crafted_item,
      r.horde_crafted_item,
      ...(r.crafted_items || []).map((i) => ('item' in i ? i.item : i)),
    ].filter((i): i is z.infer<typeof named> => Boolean(i));
    let iconUrl: string | null = null;
    if (r.media?.id === id) {
      try {
        const media = z
          .object({
            id: positiveId,
            assets: z.array(z.object({ key: z.string(), value: z.string() })).max(20),
          })
          .safeParse(await this.get(`/data/wow/media/recipe/${id}`, this.settings.dataNamespace));
        if (media.success && media.data.id === id)
          iconUrl =
            media.data.assets.find(
              (a) =>
                a.key === 'icon' &&
                /^https:\/\/render\.worldofwarcraft\.com\/[a-zA-Z0-9/_\-.]+$/.test(a.value),
            )?.value || null;
      } catch (error) {
        // Item mappings remain useful when optional media is missing. Preserve rate-limit backoff.
        if (error instanceof BlizzardError && [429, 503].includes(error.status)) throw error;
      }
    }
    return {
      id,
      name: r.name,
      iconUrl,
      reagents:
        r.reagents?.map(({ reagent, quantity }) => ({
          id: reagent.id,
          name: reagent.name,
          quantity: quantity ?? null,
        })) ?? null,
      modifiedReagents: Boolean(r.modified_crafting_slots?.length),
      items: [...new Map(items.map((i) => [i.id, { id: i.id, name: i.name }])).values()],
    };
  }
}
