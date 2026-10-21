import { describe, expect, it, vi } from 'vitest';
import { BlizzardClient, blizzardSettings, normalizeProfessions } from './blizzard.js';

// Synthetic API contract fixtures: these are never loaded into application data.
const settings = { ...blizzardSettings(), clientId: 'test-id', clientSecret: 'test-secret' };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
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
    expect(calls[1].url).toContain('namespace=static-us');
    expect(calls.map((c) => c.url).join()).not.toMatch(/test-secret|secret-token/);
    expect(calls[1].init.headers).toEqual({ Authorization: 'Bearer secret-token' });
  });
  it('validates guild identity before trusting a cross-realm roster', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(response({ id: 8, name: 'Rewound', realm: { slug: 'area-52' } }))
      .mockResolvedValueOnce(
        response({
          guild: { id: 8, name: 'Rewound', realm: { slug: 'area-52' } },
          members: [
            {
              character: {
                id: 1,
                name: 'Synthetic',
                realm: { slug: 'other-realm' },
                playable_class: { id: 13 },
              },
            },
          ],
        }),
      );
    expect((await new BlizzardClient(settings, fetcher).roster()).characters[0]).toMatchObject({
      realm: 'other-realm',
      classId: 13,
    });
    const mismatch = vi
      .fn()
      .mockResolvedValueOnce(response({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(
        response({ id: 8, name: 'Different guild', realm: { slug: 'area-52' } }),
      );
    await expect(new BlizzardClient(settings, mismatch).roster()).rejects.toThrow(
      'unexpected data',
    );
    expect(mismatch).toHaveBeenCalledTimes(2);
  });
  it('reads class IDs from character profiles and leaves missing class data unknown', async () => {
    for (const classId of [6, null]) {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(response({ access_token: 'token', expires_in: 3600 }))
        .mockResolvedValueOnce(
          response({
            id: 1,
            name: 'Synthetic',
            realm: { slug: 'area-52' },
            ...(classId ? { character_class: { id: classId } } : {}),
          }),
        )
        .mockResolvedValueOnce(response({ character: { id: 1 }, primaries: [] }));
      expect(
        (await new BlizzardClient(settings, fetcher).character('area-52', 'synthetic')).classId,
      ).toBe(classId);
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
