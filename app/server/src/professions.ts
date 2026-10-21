import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type {
  DirectoryCharacter,
  DirectoryRecipe,
  ProfessionDirectory,
  ProfessionSnapshot,
  RecipeMaterials,
} from '@spf/shared';
import type { Database, Executor } from './database.js';
import { requireAuth, type AuthRequest } from './auth.js';
import { HttpError } from './roster.js';
import {
  BlizzardClient,
  BlizzardError,
  blizzardSettings,
  scopeId,
  type BlizzardSource,
} from './blizzard.js';

const characterColumns = `c.id,c.name,c.realm,c.class_id AS "classId",c.in_roster AS "inRoster",c.seed,c.last_success AS "lastSuccess",c.last_attempt AS "lastAttempt",c.refresh_after AS "refreshAfter",c.error,
  EXISTS(SELECT 1 FROM profs_jobs j WHERE j.character_id=c.id) AS queued,
  u.username AS member,u.id AS "memberId",m.discord,main.name AS main,CASE WHEN main.id IS NULL THEN NULL ELSE main.id=c.id END AS "isMain"`;
const characterJoins = `LEFT JOIN profs_claims cl ON cl.character_id=c.id AND cl.status='approved'
  LEFT JOIN users u ON u.id=cl.user_id LEFT JOIN profs_members m ON m.user_id=u.id AND m.scope_id=c.scope_id
  LEFT JOIN profs_characters main ON main.id=m.main_character_id AND EXISTS(SELECT 1 FROM profs_claims mc WHERE mc.character_id=main.id AND mc.user_id=u.id AND mc.status='approved')`;
const uuid = z.uuid();
const safeError = (e: unknown) =>
  e instanceof BlizzardError
    ? e.message
    : 'Refresh failed. Last successful data was kept. Try again after the cooldown.';
export class ProfessionService {
  readonly scope: string;
  private busy = false;
  private stopping = false;
  // Public hovers can warm the existing bounded worker cache, never call Blizzard directly.
  readonly requestedRecipes = new Set<number>();
  constructor(
    readonly db: Database,
    readonly settings = blizzardSettings(),
    readonly source: BlizzardSource = new BlizzardClient(settings),
  ) {
    this.scope = scopeId(settings);
  }
  isAdmin(username: string) {
    return this.settings.admins.includes(username.toLowerCase());
  }
  async ensureScope() {
    const s = this.settings;
    await this.db.query(
      `INSERT INTO profs_scopes(id,game_version,region,profile_namespace,data_namespace,guild_name,guild_realm) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [
        this.scope,
        s.gameVersion,
        s.region,
        s.profileNamespace,
        s.dataNamespace,
        s.guild,
        s.guildRealm,
      ],
    );
    const row = (
      await this.db.query<{
        profile_namespace: string;
        data_namespace: string;
        guild_name: string;
        guild_realm: string;
      }>('SELECT * FROM profs_scopes WHERE id=$1', [this.scope])
    ).rows[0];
    if (
      row.profile_namespace !== s.profileNamespace ||
      row.data_namespace !== s.dataNamespace ||
      row.guild_name !== s.guild ||
      row.guild_realm !== s.guildRealm
    )
      throw new HttpError(
        409,
        'Directory configuration differs from the stored scope. An administrator must migrate it before importing.',
      );
  }
  async queue(kind: 'roster' | 'character', characterId?: string) {
    if (!this.source.configured)
      throw new HttpError(503, 'Blizzard credentials must be configured on the server.');
    await this.ensureScope();
    await this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM profs_scopes WHERE id=$1 FOR UPDATE', [this.scope]);
      const count = (
        await tx.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM profs_jobs WHERE scope_id=$1',
          [this.scope],
        )
      ).rows[0].count;
      if (count >= 100) throw new HttpError(429, 'The refresh queue is full. Try again later.');
      if (kind === 'character') {
        const c = (
          await tx.query<{ refresh_after: string | null }>(
            'SELECT refresh_after FROM profs_characters WHERE id=$1 AND scope_id=$2 AND (in_roster OR seed)',
            [characterId, this.scope],
          )
        ).rows[0];
        if (!c) throw new HttpError(404, 'Registered character not found.');
        if (c.refresh_after && new Date(c.refresh_after).getTime() > Date.now())
          throw new HttpError(429, 'This character is on a 15-minute refresh cooldown.');
        await tx.query(
          "UPDATE profs_characters SET refresh_after=now()+interval '15 minutes' WHERE id=$1",
          [characterId],
        );
      } else {
        const row = (
          await tx.query<{ ready: boolean }>(
            'SELECT roster_refresh_after IS NULL OR roster_refresh_after<=now() AS ready FROM profs_scopes WHERE id=$1',
            [this.scope],
          )
        ).rows[0];
        if (!row.ready) throw new HttpError(429, 'Roster refresh is on a 15-minute cooldown.');
        await tx.query(
          "UPDATE profs_scopes SET roster_refresh_after=now()+interval '15 minutes' WHERE id=$1",
          [this.scope],
        );
      }
      await tx.query(
        'INSERT INTO profs_jobs(id,scope_id,kind,character_id,priority) VALUES($1,$2,$3,$4,20) ON CONFLICT DO NOTHING',
        [randomUUID(), this.scope, kind, characterId || null],
      );
    });
  }
  async scheduleDue() {
    if (!this.settings.autoRefresh || !this.source.configured) return 0;
    await this.ensureScope();
    return this.db.transaction(async (tx) => {
      const scope = (
        await tx.query<{ paused: boolean; rosterDue: boolean }>(
          `SELECT (api_backoff_until>now()) AS paused,
        ((roster_synced IS NULL OR roster_synced<=now()-$2*interval '1 minute') AND (roster_refresh_after IS NULL OR roster_refresh_after<=now())) AS "rosterDue"
        FROM profs_scopes WHERE id=$1 FOR UPDATE`,
          [this.scope, this.settings.refreshIntervalMinutes],
        )
      ).rows[0];
      if (scope.paused) return 0;
      const currentCount = (
        await tx.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM profs_jobs WHERE scope_id=$1',
          [this.scope],
        )
      ).rows[0].count;
      if (scope.rosterDue && currentCount < 90) {
        await tx.query(
          `INSERT INTO profs_jobs(id,scope_id,kind,priority) VALUES($1,$2,'roster',10) ON CONFLICT DO NOTHING`,
          [randomUUID(), this.scope],
        );
        await tx.query(
          "UPDATE profs_scopes SET roster_refresh_after=now()+interval '15 minutes' WHERE id=$1",
          [this.scope],
        );
      }
      const count = (
        await tx.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM profs_jobs WHERE scope_id=$1',
          [this.scope],
        )
      ).rows[0].count;
      // Keep ten slots free for manually requested refreshes. Refill in small batches.
      const limit = Math.min(25, Math.max(0, 90 - count));
      if (!limit) return 0;
      const due = (
        await tx.query<{ id: string }>(
          `SELECT c.id FROM profs_characters c WHERE c.scope_id=$1 AND c.in_roster
        AND (c.last_attempt IS NULL OR c.last_attempt<=now()-$2*interval '1 minute')
        AND (c.refresh_after IS NULL OR c.refresh_after<=now())
        AND NOT EXISTS(SELECT 1 FROM profs_jobs j WHERE j.character_id=c.id)
        ORDER BY c.last_attempt NULLS FIRST,c.id LIMIT $3`,
          [this.scope, this.settings.refreshIntervalMinutes, limit],
        )
      ).rows;
      for (const c of due) {
        await tx.query(
          `INSERT INTO profs_jobs(id,scope_id,kind,character_id,priority) VALUES($1,$2,'character',$3,0) ON CONFLICT DO NOTHING`,
          [randomUUID(), this.scope, c.id],
        );
        await tx.query(
          "UPDATE profs_characters SET refresh_after=now()+interval '15 minutes' WHERE id=$1",
          [c.id],
        );
      }
      return due.length;
    });
  }
  private async backOff(error: unknown) {
    if (this.stopping) return false;
    if (!(error instanceof BlizzardError) || ![429, 503].includes(error.status)) return false;
    await this.db.query(
      "UPDATE profs_scopes SET api_backoff_until=now()+interval '15 minutes' WHERE id=$1",
      [this.scope],
    );
    return true;
  }
  private async saveCharacter(
    tx: Executor,
    c: {
      id: number;
      name: string;
      realm: string;
      classId?: number | null;
      snapshot: ProfessionSnapshot;
    },
    localId: string,
  ) {
    await tx.query(
      'UPDATE profs_characters SET name=$1,realm=$2,snapshot=$3,class_id=COALESCE($7,class_id),last_success=now(),last_attempt=now(),error=NULL WHERE id=$4 AND scope_id=$5 AND api_id=$6',
      [c.name, c.realm, JSON.stringify(c.snapshot), localId, this.scope, c.id, c.classId ?? null],
    );
    await tx.query('DELETE FROM profs_known_recipes WHERE character_id=$1', [localId]);
    // Batch insertion keeps a large learned-recipe list bounded to two queries.
    const records = c.snapshot.tiers.flatMap((t) =>
      t.recipes.map((r) => ({
        id: r.id,
        name: r.name,
        profession: t.profession,
        expansion: t.expansion,
      })),
    );
    const json = JSON.stringify(records);
    await tx.query(
      `INSERT INTO profs_recipes(scope_id,api_id,name) SELECT DISTINCT ON (id) $1,id,name FROM jsonb_to_recordset($2::jsonb) AS x(id bigint,name text,profession text,expansion text) ON CONFLICT (scope_id,api_id) DO UPDATE SET name=EXCLUDED.name`,
      [this.scope, json],
    );
    await tx.query(
      `INSERT INTO profs_known_recipes(character_id,scope_id,recipe_id,profession,expansion) SELECT DISTINCT $1::uuid,$2,id,profession,expansion FROM jsonb_to_recordset($3::jsonb) AS x(id bigint,name text,profession text,expansion text)`,
      [localId, this.scope, json],
    );
  }
  async seedEizzo() {
    if (this.settings.gameVersion !== 'retail' || this.settings.region !== 'us')
      throw new HttpError(400, 'Eizzo validation is scoped to retail US.');
    return this.seedValidationCharacter('area-52', 'eizzo');
  }
  async seedValidationCharacter(realm: string, name: string) {
    if (this.settings.gameVersion !== 'retail')
      throw new HttpError(400, 'Live validation is currently enabled only for retail.');
    await this.ensureScope();
    const c = await this.source.character(realm, name);
    return this.db.transaction(async (tx) => {
      const id = (
        await tx.query<{ id: string }>(
          `INSERT INTO profs_characters(id,scope_id,api_id,name,realm,seed) VALUES($1,$2,$3,$4,$5,true) ON CONFLICT (scope_id,api_id) DO UPDATE SET seed=true RETURNING id`,
          [randomUUID(), this.scope, c.id, c.name, c.realm],
        )
      ).rows[0].id;
      await this.saveCharacter(tx, c, id);
      return id;
    });
  }
  async workOne(enrichAfterJob = false, automatic = false) {
    if (this.stopping || this.busy || !this.source.configured) return false;
    this.busy = true;
    try {
      await this.ensureScope();
      const paused = (
        await this.db.query<{ paused: boolean }>(
          'SELECT api_backoff_until>now() AS paused FROM profs_scopes WHERE id=$1',
          [this.scope],
        )
      ).rows[0].paused;
      if (paused) return false;
      if (automatic) await this.scheduleDue();
      const job = await this.db.transaction(async (tx) => {
        const row = (
          await tx.query<{ id: string; kind: string; character_id: string | null }>(
            `SELECT * FROM profs_jobs WHERE scope_id=$1 AND (lease_until IS NULL OR lease_until<now()) ORDER BY priority DESC,created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`,
            [this.scope],
          )
        ).rows[0];
        if (row)
          await tx.query(
            "UPDATE profs_jobs SET started_at=now(),lease_until=now()+interval '5 minutes' WHERE id=$1",
            [row.id],
          );
        return row;
      });
      if (!job) return await this.enrichRecipes();
      try {
        if (job.kind === 'roster') {
          const roster = await this.source.roster();
          await this.db.transaction(async (tx) => {
            await tx.query('UPDATE profs_characters SET in_roster=false WHERE scope_id=$1', [
              this.scope,
            ]);
            for (const c of roster.characters)
              await tx.query(
                `INSERT INTO profs_characters(id,scope_id,api_id,name,realm,in_roster,class_id) VALUES($1,$2,$3,$4,$5,true,$6) ON CONFLICT (scope_id,api_id) DO UPDATE SET name=EXCLUDED.name,realm=EXCLUDED.realm,in_roster=true,class_id=COALESCE(EXCLUDED.class_id,profs_characters.class_id)`,
                [randomUUID(), this.scope, c.id, c.name, c.realm, c.classId ?? null],
              );
            await tx.query(
              'UPDATE profs_scopes SET guild_api_id=$1,roster_synced=now(),roster_error=NULL WHERE id=$2',
              [roster.guildId, this.scope],
            );
          });
        } else {
          const c = (
            await this.db.query<{ api_id: string; name: string; realm: string }>(
              'SELECT * FROM profs_characters WHERE id=$1 AND scope_id=$2',
              [job.character_id, this.scope],
            )
          ).rows[0];
          if (!c) throw new Error('Missing character');
          await this.db.query(
            "UPDATE profs_characters SET last_attempt=now(),refresh_after=greatest(refresh_after,now()+interval '15 minutes') WHERE id=$1",
            [job.character_id],
          );
          const result = await this.source.character(c.realm, c.name);
          if (result.id !== Number(c.api_id))
            throw new BlizzardError(
              409,
              'Character identity changed. An administrator must review the roster. Last successful data was kept.',
            );
          await this.db.transaction((tx) => this.saveCharacter(tx, result, job.character_id!));
        }
      } catch (error) {
        if (this.stopping) {
          await this.db.query(
            'UPDATE profs_jobs SET started_at=NULL,lease_until=NULL WHERE id=$1',
            [job.id],
          );
          return false;
        }
        await this.backOff(error);
        if (job.kind === 'roster')
          await this.db.query('UPDATE profs_scopes SET roster_error=$1 WHERE id=$2', [
            safeError(error),
            this.scope,
          ]);
        else
          await this.db.query(
            'UPDATE profs_characters SET error=$1,last_attempt=now() WHERE id=$2',
            [safeError(error), job.character_id],
          );
      }
      await this.db.query('DELETE FROM profs_jobs WHERE id=$1', [job.id]);
      const backoff = (
        await this.db.query<{ paused: boolean }>(
          'SELECT api_backoff_until>now() AS paused FROM profs_scopes WHERE id=$1',
          [this.scope],
        )
      ).rows[0].paused;
      if (enrichAfterJob && !backoff) await this.enrichRecipes();
      return true;
    } finally {
      this.busy = false;
    }
  }
  async enrichRecipes() {
    // At most five detail requests per worker tick. Failures back off for one day.
    const rows = (
      await this.db.query<{ api_id: string }>(
        `SELECT r.api_id FROM profs_recipes r WHERE r.scope_id=$1 AND (r.metadata_version<2 OR r.details_fetched IS NULL OR r.details_fetched<now()-interval '30 days') AND (r.detail_attempt IS NULL OR r.detail_attempt<now()-interval '1 day' OR (r.metadata_version<2 AND r.detail_error IS NULL)) AND EXISTS(SELECT 1 FROM profs_known_recipes k JOIN profs_characters c ON c.id=k.character_id WHERE k.scope_id=r.scope_id AND k.recipe_id=r.api_id AND (c.in_roster OR c.seed)) ORDER BY (r.api_id=ANY($2::bigint[])) DESC,r.detail_priority DESC NULLS LAST,r.detail_attempt NULLS FIRST,r.api_id LIMIT 5`,
        [this.scope, [...this.requestedRecipes]],
      )
    ).rows;
    for (const row of rows) {
      if (this.stopping) return false;
      this.requestedRecipes.delete(Number(row.api_id));
      await this.db.query(
        'UPDATE profs_recipes SET detail_attempt=now() WHERE scope_id=$1 AND api_id=$2',
        [this.scope, row.api_id],
      );
      try {
        const r = await this.source.recipe(Number(row.api_id));
        await this.db.query(
          'UPDATE profs_recipes SET items=$1,details_fetched=now(),detail_error=NULL,icon_url=$4,reagents=$5,modified_reagents=$6,metadata_version=2 WHERE scope_id=$2 AND api_id=$3',
          [
            JSON.stringify(r.items),
            this.scope,
            row.api_id,
            r.iconUrl || null,
            r.reagents == null ? null : JSON.stringify(r.reagents),
            r.modifiedReagents || false,
          ],
        );
      } catch (e) {
        if (this.stopping) {
          await this.db.query(
            'UPDATE profs_recipes SET detail_attempt=NULL WHERE scope_id=$1 AND api_id=$2',
            [this.scope, row.api_id],
          );
          return false;
        }
        await this.backOff(e);
        await this.db.query(
          'UPDATE profs_recipes SET detail_error=$1 WHERE scope_id=$2 AND api_id=$3',
          [safeError(e), this.scope, row.api_id],
        );
        // Stop this batch on upstream failure rather than amplify an outage/rate limit.
        break;
      }
    }
    return rows.length > 0;
  }
  start() {
    let running: Promise<unknown> = Promise.resolve();
    const tick = () => {
      if (!this.busy)
        running = this.workOne(true, true).catch(() =>
          console.error('Profession worker failed; queued work will retry.'),
        );
    };
    const timer = setInterval(tick, 2500);
    timer.unref();
    tick();
    return async () => {
      clearInterval(timer);
      this.stopping = true;
      this.source.stop?.();
      await running;
    };
  }
  async directory(
    userId: string | null,
    admin: boolean,
    input: unknown,
  ): Promise<ProfessionDirectory> {
    admin = Boolean(userId && admin);
    await this.ensureScope();
    const filter = z
      .object({
        q: z.string().max(150).default(''),
        profession: z.string().max(300).default(''),
        expansion: z.string().max(300).default(''),
        character: z.union([z.uuid(), z.literal('')]).default(''),
        page: z.coerce.number().int().min(1).max(20000).default(1),
      })
      .parse(input);
    const scope = (
      await this.db.query<{
        roster_synced: string | null;
        roster_error: string | null;
        api_backoff_until: string | null;
      }>('SELECT * FROM profs_scopes WHERE id=$1', [this.scope])
    ).rows[0];
    const characters = (
      await this.db.query<DirectoryCharacter>(
        `SELECT ${characterColumns},NULL AS snapshot FROM profs_characters c ${characterJoins} WHERE c.scope_id=$1 AND (c.in_roster OR c.seed) ORDER BY lower(c.name),c.realm`,
        [this.scope],
      )
    ).rows;
    const params = [
      this.scope,
      `%${filter.q}%`,
      filter.profession,
      filter.expansion,
      filter.character,
    ];
    const where = `r.scope_id=$1 AND (c.in_roster OR c.seed) AND (r.name ILIKE $2 OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.items) i WHERE i->>'name' ILIKE $2 OR i->>'id'=$6)) AND ($3='' OR k.profession=$3) AND ($4='' OR k.expansion=$4) AND ($5='' OR c.id::text=$5)`;
    const from = `FROM profs_recipes r JOIN profs_known_recipes k ON k.scope_id=r.scope_id AND k.recipe_id=r.api_id JOIN profs_characters c ON c.id=k.character_id`;
    const recipes = (
      await this.db.query<DirectoryRecipe & { total: number }>(
        `SELECT r.api_id::int AS id,r.name,k.profession,k.expansion,r.items,r.icon_url AS "iconUrl",(r.details_fetched IS NOT NULL) AS "detailsFetched",array_agg(DISTINCT c.id) AS "characterIds",count(*) OVER()::int AS total ${from} WHERE ${where} GROUP BY r.api_id,r.name,k.profession,k.expansion,r.items,r.icon_url,r.details_fetched ORDER BY lower(r.name),r.api_id,k.profession,k.expansion LIMIT 50 OFFSET $7`,
        [...params, filter.q, (filter.page - 1) * 50],
      )
    ).rows;
    const totalRecipes =
      recipes[0]?.total ??
      (
        await this.db.query<{ total: number }>(
          `SELECT count(*)::int AS total FROM (SELECT r.api_id,k.profession,k.expansion ${from} WHERE ${where} GROUP BY r.api_id,k.profession,k.expansion) matches`,
          [...params, filter.q],
        )
      ).rows[0].total;
    const facets = (
      await this.db.query<{ profession: string; expansion: string }>(
        `SELECT DISTINCT t->>'profession' AS profession,t->>'expansion' AS expansion FROM profs_characters c CROSS JOIN LATERAL jsonb_array_elements(c.snapshot->'tiers') t WHERE c.scope_id=$1 AND (c.in_roster OR c.seed)`,
        [this.scope],
      )
    ).rows;
    const claims = (
      await this.db.query<ProfessionDirectory['claims'][number]>(
        `SELECT cl.id,cl.character_id AS "characterId",c.name AS "characterName",u.username,cl.user_id AS "userId",cl.status FROM profs_claims cl JOIN profs_characters c ON c.id=cl.character_id JOIN users u ON u.id=cl.user_id WHERE cl.scope_id=$1 AND ($2::boolean OR cl.user_id=$3) ORDER BY cl.created_at DESC LIMIT 1000`,
        [this.scope, admin, userId],
      )
    ).rows;
    const myProfile = (
      await this.db.query<ProfessionDirectory['myProfile']>(
        'SELECT discord,main_character_id AS "mainCharacterId" FROM profs_members WHERE scope_id=$1 AND user_id=$2',
        [this.scope, userId],
      )
    ).rows[0] || { discord: '', mainCharacterId: null };
    const pending = (
      await this.db.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM profs_recipes r WHERE scope_id=$1 AND details_fetched IS NULL AND EXISTS(SELECT 1 FROM profs_known_recipes k JOIN profs_characters c ON c.id=k.character_id WHERE k.scope_id=r.scope_id AND k.recipe_id=r.api_id AND (c.in_roster OR c.seed))`,
        [this.scope],
      )
    ).rows[0].count;
    const rosterQueued =
      (
        await this.db.query("SELECT id FROM profs_jobs WHERE scope_id=$1 AND kind='roster'", [
          this.scope,
        ])
      ).rows.length > 0;
    return {
      gameVersion: this.settings.gameVersion,
      region: this.settings.region,
      guild: this.settings.guild,
      realm: this.settings.guildRealm,
      configured: this.source.configured,
      admin,
      rosterSynced: scope.roster_synced,
      rosterError: scope.roster_error,
      rosterQueued,
      automaticRefresh: {
        enabled: this.settings.autoRefresh,
        intervalMinutes: this.settings.refreshIntervalMinutes,
        queued: (
          await this.db.query<{ count: number }>(
            'SELECT count(*)::int AS count FROM profs_jobs WHERE scope_id=$1',
            [this.scope],
          )
        ).rows[0].count,
        backoffUntil: scope.api_backoff_until,
      },
      characters: userId
        ? characters
        : characters.map((c) => ({
            ...c,
            member: null,
            memberId: null,
            main: null,
            isMain: null,
            discord: null,
          })),
      recipes,
      totalRecipes,
      itemDetailsPending: pending,
      page: filter.page,
      pageSize: 50,
      professions: [...new Set(facets.map((f) => f.profession))].sort(),
      expansions: [...new Set(facets.map((f) => f.expansion))].sort(),
      claims,
      myProfile,
    };
  }
}

export function professionsRouter(service: ProfessionService, limits = true) {
  const router = Router();
  router.use((req, res, next) =>
    ['GET', 'HEAD'].includes(req.method) ? next() : requireAuth(req, res, next),
  );
  const metadataLimiter = rateLimit({
    windowMs: 60 * 60000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req: AuthRequest) => req.auth!.userId,
    message: { error: 'Item detail requests are temporarily limited.' },
  });
  router.post('/recipe-details', ...(limits ? [metadataLimiter] : []), async (req, res) => {
    const { recipeIds } = z
      .object({ recipeIds: z.array(z.number().int().positive().safe()).min(1).max(50) })
      .strict()
      .parse(req.body);
    await service.db.query(
      `UPDATE profs_recipes r SET detail_priority=now() WHERE r.scope_id=$1 AND r.api_id=ANY($2::bigint[]) AND (r.metadata_version<2 OR r.details_fetched IS NULL OR r.details_fetched<now()-interval '30 days') AND EXISTS(SELECT 1 FROM profs_known_recipes k JOIN profs_characters c ON c.id=k.character_id WHERE k.scope_id=r.scope_id AND k.recipe_id=r.api_id AND (c.in_roster OR c.seed))`,
      [service.scope, recipeIds],
    );
    res.status(202).json({ ok: true });
  });
  const limited = rateLimit({
    windowMs: 60 * 60000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req: AuthRequest) => req.auth!.userId,
    message: { error: 'You have reached the hourly directory write limit. Try again later.' },
  });
  router.use((req, res, next) =>
    ['GET', 'HEAD'].includes(req.method) || !limits ? next() : limited(req, res, next),
  );
  const admin = (req: AuthRequest) => {
    if (!service.isAdmin(req.auth!.username))
      throw new HttpError(403, 'Directory administrator access required.');
  };
  router.get('/', async (req: AuthRequest, res) =>
    res.json(
      await service.directory(
        req.auth?.userId ?? null,
        Boolean(req.auth && service.isAdmin(req.auth.username)),
        req.query,
      ),
    ),
  );
  router.get('/characters/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const row = (
      await service.db.query<{ snapshot: ProfessionSnapshot | null }>(
        'SELECT snapshot FROM profs_characters WHERE id=$1 AND scope_id=$2 AND (in_roster OR seed)',
        [id, service.scope],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, 'Registered character not found.');
    res.json(row);
  });
  const materialsLimiter = rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });
  router.get('/recipes/:id/materials', ...(limits ? [materialsLimiter] : []), async (req, res) => {
    const id = z.coerce.number().int().positive().safe().parse(req.params.id);
    const row = (
      await service.db.query<Omit<RecipeMaterials, 'gameVersion'>>(
        `SELECT r.items,r.reagents,r.modified_reagents AS "modifiedReagents",(r.metadata_version>=2) AS ready,(r.detail_error IS NOT NULL) AS unavailable FROM profs_recipes r WHERE r.scope_id=$1 AND r.api_id=$2 AND EXISTS(SELECT 1 FROM profs_known_recipes k JOIN profs_characters c ON c.id=k.character_id WHERE k.scope_id=r.scope_id AND k.recipe_id=r.api_id AND (c.in_roster OR c.seed))`,
        [service.scope, id],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, 'Indexed recipe not found.');
    const unavailable = !row.ready && (row.unavailable || !service.source.configured);
    if (!row.ready && !unavailable && service.requestedRecipes.size < 50)
      service.requestedRecipes.add(id);
    res.json({ ...row, unavailable, gameVersion: service.settings.gameVersion });
  });
  router.get('/recipes/:id/providers', async (req, res) => {
    const id = z.coerce.number().int().positive().safe().parse(req.params.id);
    const rows = (
      await service.db.query<{ id: string }>(
        `SELECT DISTINCT c.id FROM profs_known_recipes k JOIN profs_characters c ON c.id=k.character_id WHERE k.scope_id=$1 AND k.recipe_id=$2 AND (c.in_roster OR c.seed) ORDER BY c.id`,
        [service.scope, id],
      )
    ).rows;
    res.json({ characterIds: rows.map((c) => c.id) });
  });
  router.get('/recipes/:id/coverage', requireAuth, async (req, res) => {
    const recipeId = z.coerce.number().int().positive().safe().parse(req.params.id);
    const { profession, expansion } = z
      .object({ profession: z.string().min(1).max(300), expansion: z.string().min(1).max(300) })
      .parse(req.query);
    const recipe = await service.db.query(
      'SELECT recipe_id FROM profs_known_recipes WHERE scope_id=$1 AND recipe_id=$2 AND profession=$3 AND expansion=$4 LIMIT 1',
      [service.scope, recipeId, profession, expansion],
    );
    if (!recipe.rows.length) throw new HttpError(404, 'Indexed recipe not found.');
    const rows = (
      await service.db.query<{ id: string; snapshot: ProfessionSnapshot | null }>(
        'SELECT id,snapshot FROM profs_characters WHERE scope_id=$1 AND (in_roster OR seed)',
        [service.scope],
      )
    ).rows;
    res.json({
      characters: rows.map((c) => {
        if (!c.snapshot)
          return { id: c.id, state: 'unknown', reason: 'No successful professions fetch' };
        if (c.snapshot.tiers.some((t) => t.recipes.some((r) => r.id === recipeId)))
          return { id: c.id, state: 'known', reason: 'Listed in the last successful API snapshot' };
        const tiers = c.snapshot.tiers.filter(
          (t) => t.profession === profession && t.expansion === expansion,
        );
        if (tiers.some((t) => !t.recipesAvailable))
          return {
            id: c.id,
            state: 'unknown',
            reason: 'Blizzard did not supply this tier’s learned-recipe list',
          };
        return {
          id: c.id,
          state: 'not_listed',
          reason: tiers.length
            ? 'Not listed in the successfully fetched tier'
            : 'Profession / tier absent from the successful snapshot',
        };
      }),
    });
  });
  router.post('/refresh-roster', async (req: AuthRequest, res) => {
    admin(req);
    await service.queue('roster');
    res.status(202).json({ ok: true });
  });
  router.post('/characters/:id/refresh', async (req, res) => {
    await service.queue('character', uuid.parse(req.params.id));
    res.status(202).json({ ok: true });
  });
  router.post('/claims', async (req: AuthRequest, res) => {
    const { characterId } = z.object({ characterId: uuid }).strict().parse(req.body);
    await service.ensureScope();
    const character = await service.db.query(
      'SELECT id FROM profs_characters WHERE id=$1 AND scope_id=$2 AND (in_roster OR seed)',
      [characterId, service.scope],
    );
    if (!character.rows.length) throw new HttpError(404, 'Registered character not found.');
    await service.db.query(
      `INSERT INTO profs_claims(id,scope_id,character_id,user_id) VALUES($1,$2,$3,$4) ON CONFLICT (character_id,user_id) DO UPDATE SET status='pending',reviewed_by=NULL,reviewed_at=NULL,created_at=now() WHERE profs_claims.status='rejected'`,
      [randomUUID(), service.scope, characterId, req.auth!.userId],
    );
    res.status(201).json({ ok: true });
  });
  router.put('/claims/:id', async (req: AuthRequest, res) => {
    admin(req);
    const id = uuid.parse(req.params.id);
    const { status } = z
      .object({ status: z.enum(['approved', 'rejected']) })
      .strict()
      .parse(req.body);
    const result = await service.db.query(
      'UPDATE profs_claims SET status=$1,reviewed_by=$2,reviewed_at=now() WHERE id=$3 AND scope_id=$4 RETURNING id',
      [status, req.auth!.userId, id, service.scope],
    );
    if (!result.rowCount) throw new HttpError(404, 'Claim not found.');
    res.json({ ok: true });
  });
  router.put('/member', async (req: AuthRequest, res) => {
    const body = z
      .object({ discord: z.string().trim().max(100), mainCharacterId: uuid.nullable() })
      .strict()
      .parse(req.body);
    await service.ensureScope();
    await service.db.transaction(async (tx) => {
      if (body.mainCharacterId) {
        const own = await tx.query(
          "SELECT id FROM profs_claims WHERE character_id=$1 AND scope_id=$2 AND user_id=$3 AND status='approved' FOR UPDATE",
          [body.mainCharacterId, service.scope, req.auth!.userId],
        );
        if (!own.rows.length)
          throw new HttpError(403, 'Your main must be an administrator-approved character.');
      }
      await tx.query(
        `INSERT INTO profs_members(scope_id,user_id,discord,main_character_id) VALUES($1,$2,$3,$4) ON CONFLICT (scope_id,user_id) DO UPDATE SET discord=EXCLUDED.discord,main_character_id=EXCLUDED.main_character_id`,
        [service.scope, req.auth!.userId, body.discord, body.mainCharacterId],
      );
    });
    res.json({ ok: true });
  });
  return router;
}
