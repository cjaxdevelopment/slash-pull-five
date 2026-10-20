import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import {
  catalog,
  characterSchema,
  planSchema,
  assignmentSchema,
  idSchema,
  csvCell,
  csvHeaders,
  type Workspace,
  type Character,
  type AssignmentInput,
  type Plan,
} from '@spf/shared';
import { config } from './config.js';
import type { Database, Executor } from './database.js';
import {
  hashPassword,
  verifyPassword,
  sessions,
  requireAuth,
  issueSession,
  accountCredentials,
  type AuthRequest,
} from './auth.js';
import {
  HttpError,
  activity,
  insertCharacter,
  characterColumns,
  snapshot,
  importCsv,
} from './roster.js';

const credentials = accountCredentials;
const revisionSchema = z.number().int().positive();
interface GuildRequest extends AuthRequest {
  workspace?: Workspace;
}
const param = (req: Request, name: string) => idSchema.parse(req.params[name]);
export function createApp(db: Database, options: { rateLimit?: boolean } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(helmet());
  if (config.production)
    app.use((req, res, next) => {
      if (
        req.path !== '/api/health' &&
        (!req.secure || req.get('host') !== new URL(config.origin).host)
      ) {
        res.redirect(308, config.origin + req.originalUrl);
        return;
      }
      next();
    });
  app.use(express.json({ limit: '1mb' }));
  if (options.rateLimit !== false)
    app.use(
      '/api',
      rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }),
    );
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('Origin') !== config.origin) {
      res.status(403).json({ error: 'This request must come from the planner application.' });
      return;
    }
    next();
  });
  app.use('/api', sessions(db));
  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true });
  });
  app.get('/api/catalog', (_req, res) => res.json(catalog));
  app.get('/api/session', async (req: AuthRequest, res) => {
    if (!req.auth) {
      res.json({ user: null, workspaces: [] });
      return;
    }
    const workspaces = await db.query<Workspace>(
      "SELECT g.*,a.role FROM guild_access a JOIN guilds g ON g.id=a.guild_id WHERE a.user_id=$1 AND a.role='owner' ORDER BY g.name",
      [req.auth.userId],
    );
    res.json({
      user: { id: req.auth.userId, username: req.auth.username },
      csrfToken: req.auth.csrf,
      workspaces: workspaces.rows,
    });
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60000,
    limit: 12,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  app.post(
    '/api/login',
    ...(options.rateLimit === false ? [] : [authLimiter]),
    async (req, res) => {
      const { username, password } = credentials.parse(req.body);
      const user = (
        await db.query<{ id: string; passwordHash: string }>(
          'SELECT id,password_hash AS "passwordHash" FROM users WHERE username=$1',
          [username],
        )
      ).rows[0];
      const valid = user
        ? await verifyPassword(password, user.passwordHash)
        : (await hashPassword(password), false);
      if (!user || !valid) throw new HttpError(401, 'Invalid username or password.');
      const prior = (req as AuthRequest).auth;
      if (prior) await db.query('DELETE FROM sessions WHERE token_hash=$1', [prior.hash]);
      await issueSession(db, user.id, res);
      res.json({ ok: true });
    },
  );
  app.post('/api/logout', requireAuth, async (req: AuthRequest, res) => {
    await db.query('DELETE FROM sessions WHERE token_hash=$1', [req.auth!.hash]);
    res.clearCookie('spf_session', {
      path: '/',
      httpOnly: true,
      secure: config.production,
      sameSite: 'strict',
    });
    res.json({ ok: true });
  });
  const guild = express.Router({ mergeParams: true });
  guild.use(requireAuth, async (req: GuildRequest, _res, next) => {
    const id = param(req, 'guildId');
    const row = (
      await db.query<Workspace>(
        "SELECT g.*,a.role FROM guilds g JOIN guild_access a ON a.guild_id=g.id WHERE g.id=$1 AND a.user_id=$2 AND a.role='owner'",
        [id, req.auth!.userId],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, 'Workspace not found.');
    req.workspace = row;
    next();
  });
  // All workspace writes lock the guild, recheck access, and commit the audit entry atomically.
  async function write<T>(
    req: GuildRequest,
    action: string,
    fn: (tx: Executor, g: Workspace) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      await tx.query('SELECT id FROM guilds WHERE id=$1 FOR UPDATE', [req.workspace!.id]);
      const permission = (
        await tx.query<{ role: string }>(
          'SELECT role FROM guild_access WHERE guild_id=$1 AND user_id=$2',
          [req.workspace!.id, req.auth!.userId],
        )
      ).rows[0];
      if (permission?.role !== 'owner')
        throw new HttpError(403, 'This planner belongs to another account.');
      const result = await fn(tx, req.workspace!);
      await activity(tx, req.workspace!.id, req.auth!.userId, action);
      return result;
    });
  }
  async function lockPlan(tx: Executor, guildId: string, id: string, revision: number) {
    const plan = (
      await tx.query<Pick<Plan, 'id' | 'capacity' | 'revision'>>(
        'SELECT id,capacity,revision FROM plans WHERE id=$1 AND guild_id=$2 FOR UPDATE',
        [id, guildId],
      )
    ).rows[0];
    if (!plan) throw new HttpError(404, 'Raid plan not found.');
    if (plan.revision !== revision)
      throw new HttpError(
        409,
        'This plan changed in another tab. It has been refreshed; review their changes and try again.',
      );
    return plan;
  }
  const bump = (tx: Executor, id: string) =>
    tx.query('UPDATE plans SET revision=revision+1,updated_at=now() WHERE id=$1', [id]);
  guild.get('/snapshot', async (req: GuildRequest, res) =>
    res.json(await db.transaction((tx) => snapshot(tx, req.workspace!))),
  );
  guild.post('/characters', async (req: GuildRequest, res) => {
    const c = characterSchema.parse(req.body);
    const id = await write(req, 'Added character ' + c.name, (tx, g) => insertCharacter(tx, g, c));
    res.status(201).json({ id });
  });
  guild.put('/characters/:id', async (req: GuildRequest, res) => {
    const id = param(req, 'id');
    const { character: c, revision } = z
      .object({ character: characterSchema, revision: revisionSchema })
      .strict()
      .parse(req.body);
    await write(req, 'Updated character ' + c.name, async (tx, g) => {
      const result = await tx.query(
        `UPDATE characters SET first_name=$1,last_name='',class=$2,spec=$3,preferred_role=$4,buffs=$5,revision=revision+1,updated_at=now() WHERE id=$6 AND guild_id=$7 AND revision=$8 RETURNING id`,
        [c.name, c.class, c.spec, c.role, JSON.stringify(c.buffs), id, g.id, revision],
      );
      if (!result.rows.length)
        throw new HttpError(409, 'This character changed or was removed. Refresh and try again.');
      // Character loadouts are shared by saved compositions; refresh their revisions too.
      await tx.query(
        'UPDATE plans SET revision=revision+1,updated_at=now() WHERE guild_id=$1 AND id IN (SELECT plan_id FROM assignments WHERE character_id=$2)',
        [g.id, id],
      );
    });
    res.json({ ok: true });
  });
  guild.delete('/characters/:id', async (req: GuildRequest, res) => {
    const id = param(req, 'id');
    const { revision } = z.object({ revision: revisionSchema }).strict().parse(req.body);
    await write(req, 'Deleted character ' + id, async (tx, g) => {
      const character = (
        await tx.query<{ revision: number }>(
          'SELECT revision FROM characters WHERE id=$1 AND guild_id=$2 FOR UPDATE',
          [id, g.id],
        )
      ).rows[0];
      if (!character) throw new HttpError(404, 'Character not found.');
      if (character.revision !== revision)
        throw new HttpError(
          409,
          'This character changed. It has been refreshed; review it and try again.',
        );
      await tx.query(
        'UPDATE plans SET revision=revision+1,updated_at=now() WHERE guild_id=$1 AND id IN (SELECT plan_id FROM assignments WHERE character_id=$2)',
        [g.id, id],
      );
      await tx.query('DELETE FROM assignments WHERE character_id=$1 AND guild_id=$2', [id, g.id]);
      await tx.query('DELETE FROM characters WHERE id=$1 AND guild_id=$2', [id, g.id]);
    });
    res.json({ ok: true });
  });
  guild.post('/plans', async (req: GuildRequest, res) => {
    const p = planSchema.parse(req.body);
    const id = await write(req, 'Created composition ' + p.name, async (tx, g) => {
      const id = randomUUID();
      await tx.query(
        `INSERT INTO plans(id,guild_id,name,encounter,capacity,notes,targets,catalog_version) VALUES($1,$2,$3,'custom',$4,$5,'{}',$6)`,
        [id, g.id, p.name, p.capacity, p.notes, catalog.version],
      );
      return id;
    });
    res.status(201).json({ id });
  });
  guild.put('/plans/:id', async (req: GuildRequest, res) => {
    const id = param(req, 'id');
    const { plan: p, revision } = z
      .object({ plan: planSchema, revision: revisionSchema })
      .strict()
      .parse(req.body);
    await write(req, 'Updated composition ' + p.name, async (tx, g) => {
      await lockPlan(tx, g.id, id, revision);
      const assigned = (
        await tx.query<{ total: number; highest: number }>(
          "SELECT count(*)::int AS total,coalesce(max(group_number),0)::int AS highest FROM assignments WHERE plan_id=$1 AND status='lineup'",
          [id],
        )
      ).rows[0];
      if (assigned.total > p.capacity || assigned.highest > Math.ceil(p.capacity / 5))
        throw new HttpError(
          400,
          'Move characters to the bench or an earlier group before reducing the raid size.',
        );
      // A partial final group must also fit the new raid size.
      const last = (
        await tx.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM assignments WHERE plan_id=$1 AND status='lineup' AND group_number=$2",
          [id, Math.ceil(p.capacity / 5)],
        )
      ).rows[0].count;
      if (last > Math.min(5, p.capacity - (Math.ceil(p.capacity / 5) - 1) * 5))
        throw new HttpError(400, 'The final group has too many characters for that raid size.');
      await tx.query(
        'UPDATE plans SET name=$1,capacity=$2,notes=$3,revision=revision+1,updated_at=now() WHERE id=$4',
        [p.name, p.capacity, p.notes, id],
      );
    });
    res.json({ ok: true });
  });
  guild.post('/plans/:id/duplicate', async (req: GuildRequest, res) => {
    const source = param(req, 'id');
    const { revision } = z.object({ revision: revisionSchema }).strict().parse(req.body);
    const id = await write(req, 'Duplicated a composition', async (tx, g) => {
      await lockPlan(tx, g.id, source, revision);
      const id = randomUUID();
      await tx.query(
        `INSERT INTO plans(id,guild_id,name,encounter,capacity,notes,targets,catalog_version) SELECT $1,guild_id,left(name,73)||' (copy)',encounter,capacity,notes,targets,catalog_version FROM plans WHERE id=$2`,
        [id, source],
      );
      const rows = (
        await tx.query<{
          characterId: string;
          status: string;
          group: number | null;
          slot: number | null;
          role: string;
        }>(
          'SELECT character_id AS "characterId",status,group_number AS "group",slot,role FROM assignments WHERE plan_id=$1',
          [source],
        )
      ).rows;
      for (const a of rows)
        await tx.query(
          'INSERT INTO assignments(id,guild_id,plan_id,character_id,role,status,group_number,slot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [randomUUID(), g.id, id, a.characterId, a.role, a.status, a.group, a.slot],
        );
      return id;
    });
    res.status(201).json({ id });
  });
  guild.delete('/plans/:id', async (req: GuildRequest, res) => {
    const id = param(req, 'id');
    const { revision } = z.object({ revision: revisionSchema }).strict().parse(req.body);
    await write(req, 'Deleted a composition', async (tx, g) => {
      await lockPlan(tx, g.id, id, revision);
      await tx.query('DELETE FROM plans WHERE id=$1', [id]);
    });
    res.json({ ok: true });
  });
  async function setAssignment(
    tx: Executor,
    g: Workspace,
    planId: string,
    capacity: number,
    a: AssignmentInput,
  ) {
    const c = (
      await tx.query<Character>(
        `SELECT ${characterColumns} FROM characters WHERE id=$1 AND guild_id=$2 AND NOT archived`,
        [a.characterId, g.id],
      )
    ).rows[0];
    if (!c) throw new HttpError(404, 'Character not found.');
    const group = a.status === 'bench' ? null : a.group;
    if (group !== null && group > capacity / 5)
      throw new HttpError(400, 'That group is outside the raid size.');
    if (group === null && a.status === 'lineup' && a.slot != null)
      throw new HttpError(400, 'Choose a group for that slot.');
    type Position = { status: 'lineup' | 'bench'; group: number | null; slot: number | null };
    const source = (
      await tx.query<Position>(
        'SELECT status,group_number AS "group",slot FROM assignments WHERE plan_id=$1 AND character_id=$2',
        [planId, c.id],
      )
    ).rows[0];
    let slot: number | null = null;
    if (group !== null) {
      const occupied = (
        await tx.query<{ characterId: string; slot: number | null }>(
          `SELECT character_id AS "characterId",slot FROM assignments WHERE plan_id=$1 AND group_number=$2 AND status='lineup' AND character_id<>$3`,
          [planId, group, c.id],
        )
      ).rows;
      slot =
        a.slot ??
        (source?.group === group ? source.slot : null) ??
        [1, 2, 3, 4, 5].find((n) => !occupied.some((p) => p.slot === n)) ??
        null;
      if (slot === null) throw new HttpError(400, 'That group is full.');
      const target = occupied.find((p) => p.slot === slot);
      if (target) {
        // The deferred slot constraint lets the two positions change in one transaction.
        // A character dragged from the library returns the displaced character to the pool.
        if (source)
          await tx.query(
            'UPDATE assignments SET status=$1,group_number=$2,slot=$3 WHERE plan_id=$4 AND character_id=$5',
            [source.status, source.group, source.slot, planId, target.characterId],
          );
        else
          await tx.query('DELETE FROM assignments WHERE plan_id=$1 AND character_id=$2', [
            planId,
            target.characterId,
          ]);
      }
    }
    if (a.status === 'lineup') {
      const other = (
        await tx.query<{ total: number; inGroup: number }>(
          `SELECT count(*)::int AS total,count(*) FILTER(WHERE group_number=$3)::int AS "inGroup" FROM assignments WHERE plan_id=$1 AND character_id<>$2 AND status='lineup'`,
          [planId, c.id, group],
        )
      ).rows[0];
      if (other.total >= capacity)
        throw new HttpError(400, 'The raid is full. Move someone to the bench first.');
      if (group !== null && other.inGroup >= 5) throw new HttpError(400, 'That group is full.');
    }
    await tx.query(
      `INSERT INTO assignments(id,guild_id,plan_id,character_id,role,status,group_number,slot) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(plan_id,character_id) DO UPDATE SET role=excluded.role,status=excluded.status,group_number=excluded.group_number,slot=excluded.slot`,
      [randomUUID(), g.id, planId, c.id, c.role, a.status, group, slot],
    );
  }
  guild.put('/plans/:id/assignments', async (req: GuildRequest, res) => {
    const id = param(req, 'id');
    const { assignment: a, revision } = z
      .object({ assignment: assignmentSchema, revision: revisionSchema })
      .strict()
      .parse(req.body);
    await write(req, 'Moved a character in a composition', async (tx, g) => {
      const p = await lockPlan(tx, g.id, id, revision);
      await setAssignment(tx, g, id, p.capacity, a);
      await bump(tx, id);
    });
    res.json({ ok: true });
  });
  guild.post('/plans/:id/characters', async (req: GuildRequest, res) => {
    const planId = param(req, 'id');
    const {
      character: c,
      revision,
      group,
      slot,
      status,
    } = z
      .object({
        character: characterSchema,
        revision: revisionSchema,
        group: assignmentSchema.shape.group,
        slot: assignmentSchema.shape.slot,
        status: assignmentSchema.shape.status,
      })
      .strict()
      .parse(req.body);
    const id = await write(
      req,
      'Added character ' + c.name + ' to a composition',
      async (tx, g) => {
        const p = await lockPlan(tx, g.id, planId, revision);
        const id = await insertCharacter(tx, g, c);
        await setAssignment(tx, g, planId, p.capacity, { characterId: id, status, group, slot });
        await bump(tx, planId);
        return id;
      },
    );
    res.status(201).json({ id });
  });
  guild.delete('/plans/:id/assignments/:characterId', async (req: GuildRequest, res) => {
    const id = param(req, 'id'),
      characterId = param(req, 'characterId');
    const { revision } = z.object({ revision: revisionSchema }).strict().parse(req.body);
    await write(req, 'Removed a character from a composition', async (tx, g) => {
      await lockPlan(tx, g.id, id, revision);
      await tx.query('DELETE FROM assignments WHERE plan_id=$1 AND character_id=$2', [
        id,
        characterId,
      ]);
      await bump(tx, id);
    });
    res.json({ ok: true });
  });
  guild.post('/import', async (req: GuildRequest, res) => {
    const { csv } = z
      .object({ csv: z.string().min(1) })
      .strict()
      .parse(req.body);
    const result = await write(req, 'Imported characters', (tx, g) => importCsv(tx, g, csv));
    res.status(201).json(result);
  });
  guild.get('/export.csv', async (req: GuildRequest, res) => {
    const data = await db.transaction((tx) => snapshot(tx, req.workspace!));
    const rows = data.characters
      .filter((c) => !c.archived)
      .map((c) =>
        [c.name, c.class, c.spec, c.role, JSON.stringify(c.buffs)].map(csvCell).join(','),
      );
    res
      .type('text/csv')
      .set('Content-Disposition', 'attachment; filename="forever-characters.csv"')
      .send([csvHeaders.join(','), ...rows].join('\r\n'));
  });
  guild.get('/backup', async (req: GuildRequest, res) => {
    const data = await db.transaction((tx) => snapshot(tx, req.workspace!));
    res.set('Content-Disposition', 'attachment; filename="forever-compositions.json"').json({
      version: 2,
      exportedAt: new Date().toISOString(),
      catalogVersion: catalog.version,
      workspace: data.workspace,
      characters: data.characters,
      plans: data.plans,
    });
  });
  app.use('/api/guilds/:guildId', guild);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' ') });
      return;
    }
    const e = error as { code?: string; type?: string; status?: number };
    if (e.code === '23505') {
      res.status(409).json({
        error:
          'That name or roster assignment already exists. Review existing entries before adding it again.',
      });
      return;
    }
    if (e.code === '23503') {
      res
        .status(400)
        .json({ error: 'A linked record is missing or belongs to another workspace.' });
      return;
    }
    if (e.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON request.' });
      return;
    }
    if (e.type === 'entity.too.large') {
      res.status(413).json({ error: 'The import exceeds the 1 MB request limit.' });
      return;
    }
    console.error('Request failed', { code: e.code || 'unexpected' });
    res.status(500).json({ error: 'The request could not be completed. Please try again.' });
  });
  return app;
}
