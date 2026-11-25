import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlizzardClient, blizzardSettings, normalizeProfessions } from './blizzard.js';

// Synthetic API contract fixtures: these are never loaded into application data.
const settings = { ...blizzardSettings(), clientId: 'test-id', clientSecret: 'test-secret' };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
afterEach(() => vi.unstubAllEnvs());

describe('Forever deployment settings', () => {
  it('starts with inherited retail overrides and still exclusively requests Forever data', async () => {
    vi.stubEnv('PROFS_GAME_VERSION', 'retail');
    vi.stubEnv('PROFS_PROFILE_NAMESPACE', 'profile-us');
    vi.stubEnv('PROFS_DATA_NAMESPACE', 'static-us');
    vi.stubEnv('PROFS_GUILD_REALM', 'area-52');
    vi.stubEnv('PROFS_REGION', 'us');
    const configured = { ...blizzardSettings(), clientId: 'test-id', clientSecret: 'test-secret' };
    expect(configured).toMatchObject({
      gameVersion: 'forever',
      profileNamespace: 'profile-forever-us',
      dataNamespace: 'static-forever-us',
      rulesetId: 2,
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ access_token: 'test-token', expires_in: 3600 }))
      .mockResolvedValueOnce(response({ id: 99, name: 'Recipe' }));
    const client = new BlizzardClient(configured, fetcher);
    expect(client.configured).toBe(true);
    await client.recipe(99);
    expect(String(fetcher.mock.calls[1][0])).toContain('namespace=static-forever-us');
  });
  it('derives both namespaces from the selected region despite old namespace overrides', () => {
    vi.stubEnv('PROFS_REGION', 'eu');
    vi.stubEnv('PROFS_PROFILE_NAMESPACE', 'profile-us');
    vi.stubEnv('PROFS_DATA_NAMESPACE', 'static-us');
    expect(blizzardSettings()).toMatchObject({
      region: 'eu',
      gameVersion: 'forever',
      profileNamespace: 'profile-forever-eu',
      dataNamespace: 'static-forever-eu',
    });
  });
});
describe('Blizzard adapter', () => {
  it('preserves reagent item IDs and quantities, missing data, and modified reagent slots', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ access_token: 'test-token', expires_in: 3600 }))
      .mockResolvedValueOnce(
        response({
          id: 99,
          name: 'Recipe',
          reagents: [
            { reagent: { id: 765, name: 'Silverleaf' }, quantity: 2 },
            { reagent: { id: 3371, name: 'Crystal Vial' } },
          ],
          modified_crafting_slots: [{ slot: { id: 1 } }],
        }),
      )
      .mockResolvedValueOnce(response({ id: 100, name: 'Gathering action' }))
      .mockResolvedValueOnce(response({ id: 101, name: 'Action', reagents: [] }));
    const client = new BlizzardClient(settings, fetcher);
    expect(await client.recipe(99)).toMatchObject({
      reagents: [
        { id: 765, name: 'Silverleaf', quantity: 2 },
        { id: 3371, name: 'Crystal Vial', quantity: null },
      ],
      modifiedReagents: true,
    });
    expect((await client.recipe(100)).reagents).toBeNull();
    expect((await client.recipe(101)).reagents).toEqual([]);
  });
  it('uses the recipe media endpoint for icons without inventing a crafted item or accepting another host', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ access_token: 'test-token', expires_in: 3600 }))
      .mockResolvedValueOnce(response({ id: 99, name: 'Recipe action', media: { id: 99 } }))
      .mockResolvedValueOnce(
        response({
          id: 99,
          assets: [
            { key: 'icon', value: 'https://render.worldofwarcraft.com/us/icons/56/123.jpg' },
          ],
        }),
      );
    const result = await new BlizzardClient(settings, fetcher).recipe(99);
    expect(result).toMatchObject({
      id: 99,
      items: [],
      iconUrl: 'https://render.worldofwarcraft.com/us/icons/56/123.jpg',
    });
    expect(String(fetcher.mock.calls[2][0])).toContain('/data/wow/media/recipe/99');
    const wrongHost = vi
      .fn()
      .mockResolvedValueOnce(response({ access_token: 'test-token', expires_in: 3600 }))
      .mockResolvedValueOnce(response({ id: 99, name: 'Recipe action', media: { id: 99 } }))
      .mockResolvedValueOnce(
        response({
          id: 99,
          assets: [{ key: 'icon', value: 'https://untrusted.example/icon.jpg' }],
        }),
      );
    expect((await new BlizzardClient(settings, wrongHost).recipe(99)).iconUrl).toBeNull();
  });
  it('distinguishes missing learned-recipe arrays from explicit empty lists', () => {
    const snapshot = normalizeProfessions(
      {
        character: { id: 1 },
        primaries: [
          {
            profession: { id: 2, name: 'Test profession' },
            tiers: [
              { tier: { id: 3, name: 'Test tier' }, known_recipes: [] },
              { tier: { id: 4, name: 'Other tier' } },
            ],
          },
        ],
      },
      1,
    );
    expect(snapshot.tiers.map((t) => t.recipesAvailable)).toEqual([true, false]);
    expect(() => normalizeProfessions({ character: { id: 2 }, primaries: [] }, 1)).toThrow(
      'unexpected data',
    );
    expect(() => normalizeProfessions({ character: { id: 1 } }, 1)).toThrow('unexpected data');
    expect(() =>
      normalizeProfessions(
        {
          character: { id: 1 },
          primaries: [
            {
              profession: { id: 2, name: 'Test' },
              tiers: [{ tier: { id: 3, name: 'Tier' }, known_recipes: [{ name: 'Missing ID' }] }],
            },
          ],
        },
        1,
      ),
    ).toThrow('unexpected data');
  });
  it('reuses tokens, keeps them in headers, and maps multiple crafted items independently of recipe IDs', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetcher = vi.fn(async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      calls.push({ url: String(url), init: init || {} });
      return String(url).includes('/token')
        ? response({ access_token: 'secret-token', expires_in: 3600 })
        : response({
            id: 99,
            name: 'Test recipe',
            crafted_item: { id: 111, name: 'Test item' },
            horde_crafted_item: { id: 222, name: 'Other test item' },
            crafted_items: [{ item: { id: 333, name: 'Third test item' } }],
          });
    });
    const client = new BlizzardClient(settings, fetcher);
    expect((await client.recipe(99)).items.map((i) => i.id)).toEqual([111, 222, 333]);
    await client.recipe(99);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(calls[0].init.body).toBe('grant_type=client_credentials');
    expect(calls[1].url).toContain('namespace=static-forever-us');
    expect(calls.map((c) => c.url).join()).not.toMatch(/test-secret|secret-token/);
    expect(calls[1].init.headers).toEqual({ Authorization: 'Bearer secret-token' });
  });
  it('validates the realmless guild, Normal ruleset, Horde faction and roster identity', async () => {
    const guild = {
      id: 8,
      name: 'Rewound',
      slug: 'rewound',
      ruleset: { id: 2 },
      faction: { type: 'HORDE' },
    };
    const member = {
      id: 1,
      name: 'Synthetic',
      surname: 'Smith',
      slug: 'synthetic-smith',
      playable_class: { id: 7 },
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(response(guild))
      .mockResolvedValueOnce(response({ guild, members: [{ character: member }] }));
    expect(await new BlizzardClient(settings, fetcher).roster()).toEqual({
      guildId: 8,
      characters: [{ id: 1, name: 'Synthetic Smith', slug: 'synthetic-smith', classId: 7 }],
    });
    expect(String(fetcher.mock.calls[1][0])).toContain(
      '/data/wow/guild/rewound?namespace=profile-forever-us',
    );
    expect(String(fetcher.mock.calls[2][0])).toContain('/data/wow/guild/rewound/roster?');
    for (const wrong of [
      { ...guild, name: 'Other' },
      { ...guild, slug: 'other' },
      { ...guild, ruleset: { id: 1 } },
      { ...guild, faction: { type: 'ALLIANCE' } },
    ]) {
      const mismatch = vi
        .fn()
        .mockResolvedValueOnce(response({ access_token: 'token', expires_in: 3600 }))
        .mockResolvedValueOnce(response(wrong));
      await expect(new BlizzardClient(settings, mismatch).roster()).rejects.toThrow(
        'unexpected data',
      );
      expect(mismatch).toHaveBeenCalledTimes(2);
    }
    for (const wrong of [
      { guild: { ...guild, id: 9 }, members: [] },
      { guild, members: [{ character: { ...member, slug: 'wrong-slug' } }] },
    ]) {
      const mismatch = vi
        .fn()
        .mockResolvedValueOnce(response({ access_token: 'token', expires_in: 3600 }))
        .mockResolvedValueOnce(response(guild))
        .mockResolvedValueOnce(response(wrong));
      await expect(new BlizzardClient(settings, mismatch).roster()).rejects.toThrow(
        'unexpected data',
      );
    }
  });
  it('preserves characters with the same first name and different surnames', async () => {
    const guild = {
      id: 8,
      name: 'Rewound',
      slug: 'rewound',
      ruleset: { id: 2 },
      faction: { type: 'HORDE' },
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(response(guild))
      .mockResolvedValueOnce(
        response({
          guild,
          members: [
            { character: { id: 1, name: 'Synthetic', surname: 'Smith', slug: 'synthetic-smith' } },
            { character: { id: 2, name: 'Synthetic', surname: 'Jones', slug: 'synthetic-jones' } },
          ],
        }),
      );
    expect(
      (await new BlizzardClient(settings, fetcher).roster()).characters.map((c) => c.name),
    ).toEqual(['Synthetic Smith', 'Synthetic Jones']);
  });
  it('looks up the full regional slug and preserves surname and class metadata', async () => {
    for (const classId of [7, null]) {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(response({ access_token: 'token', expires_in: 3600 }))
        .mockResolvedValueOnce(
          response({
            id: 1,
            name: 'Synthetic',
            surname: 'Smith',
            ruleset: { id: 2 },
            ...(classId ? { character_class: { id: classId } } : {}),
          }),
        )
        .mockResolvedValueOnce(response({ character: { id: 1 }, primaries: [] }));
      expect(
        await new BlizzardClient(settings, fetcher).character('synthetic-smith'),
      ).toMatchObject({
        name: 'Synthetic Smith',
        slug: 'synthetic-smith',
        classId,
      });
      expect(String(fetcher.mock.calls[1][0])).toContain(
        '/profile/wow/character/synthetic-smith?namespace=profile-forever-us',
      );
      expect(String(fetcher.mock.calls[2][0])).toContain(
        '/profile/wow/character/synthetic-smith/professions?',
      );
    }
  });
  it('rejects another surname, wrong ruleset, missing identity, and mismatched profession character IDs', async () => {
    const character = { id: 1, name: 'Synthetic', surname: 'Smith', ruleset: { id: 2 } };
    for (const wrong of [
      { ...character, surname: 'Other' },
      { ...character, ruleset: { id: 1 } },
      { ...character, slug: 'synthetic-other' },
      { id: 1, name: 'Synthetic' },
    ]) {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(response({ access_token: 'token', expires_in: 3600 }))
        .mockResolvedValueOnce(response(wrong));
      await expect(
        new BlizzardClient(settings, fetcher).character('synthetic-smith'),
      ).rejects.toThrow('unexpected data');
      expect(fetcher).toHaveBeenCalledTimes(2);
    }
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(response(character))
      .mockResolvedValueOnce(response({ character: { id: 2 }, primaries: [] }));
    await expect(
      new BlizzardClient(settings, fetcher).character('synthetic-smith'),
    ).rejects.toThrow('unexpected data');
  });
  it('never falls back to retail or sends requests with mixed namespaces', async () => {
    for (const wrong of [
      { ...settings, gameVersion: 'retail' },
      { ...settings, profileNamespace: 'profile-us' },
      { ...settings, dataNamespace: 'static-us' },
    ]) {
      const fetcher = vi.fn();
      const client = new BlizzardClient(wrong, fetcher);
      expect(client.configured).toBe(false);
      await expect(client.recipe(1)).rejects.toThrow('Forever');
      expect(fetcher).not.toHaveBeenCalled();
    }
  });
  it('renews once after 401 and returns safe errors without upstream bodies or credentials', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ access_token: 'old', expires_in: 3600 }))
      .mockResolvedValueOnce(response({ error: 'sensitive upstream content' }, 401))
      .mockResolvedValueOnce(response({ access_token: 'new', expires_in: 3600 }))
      .mockResolvedValueOnce(response({ error: 'sensitive upstream content' }, 403));
    await expect(new BlizzardClient(settings, fetcher).recipe(1)).rejects.toThrow(
      'Blizzard could not complete this request',
    );
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
