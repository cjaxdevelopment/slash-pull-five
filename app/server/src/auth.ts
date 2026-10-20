import {
  randomBytes,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
  randomUUID,
} from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import type { Database, Executor } from './database.js';
import { config } from './config.js';
import { workspaceSchema, type WorkspaceInput } from '@spf/shared';
export const accountCredentials = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(40)
      .regex(/^[a-z0-9_.-]+$/),
    password: z.string().min(12).max(128),
  })
  .strict();
const scrypt = promisify(scryptCallback);
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [, salt, hex] = stored.split(':');
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export interface AuthRequest extends Request {
  auth?: { userId: string; username: string; csrf: string; hash: string };
}
export function sessions(db: Database) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const cookie = req.headers.cookie
        ?.split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('spf_session='))
        ?.slice(12);
      if (cookie && /^[a-zA-Z0-9_-]{43}$/.test(cookie)) {
        const hash = hashToken(cookie);
        const r = await db.query<{ userId: string; username: string; csrf: string }>(
          'SELECT u.id AS "userId",u.username,s.csrf_token AS csrf FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',
          [hash],
        );
        if (r.rows[0]) req.auth = { ...r.rows[0], hash };
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.auth) {
    res.status(401).json({ error: 'Sign in to continue.' });
    return;
  }
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.get('X-CSRF-Token') !== req.auth.csrf
  ) {
    res.status(403).json({ error: 'Session verification failed. Refresh and try again.' });
    return;
  }
  next();
}
export async function issueSession(db: Executor, userId: string, res: Response) {
  const token = randomToken(),
    csrf = randomToken();
  await db.query('DELETE FROM sessions WHERE expires_at<=now()');
  await db.query(
    "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",
    [hashToken(token), userId, csrf],
  );
  res.cookie('spf_session', token, {
    httpOnly: true,
    secure: config.production,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  });
  return csrf;
}
export async function bootstrap(
  db: Database,
  username: string,
  password: string,
  workspace: WorkspaceInput,
) {
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    // Global database lock prevents concurrent first-owner creation on hosted PostgreSQL.
    await tx.query('LOCK TABLE users IN EXCLUSIVE MODE');
    const existing = await tx.query('SELECT id FROM users LIMIT 1');
    if (existing.rows.length)
      throw new Error('An account already exists. Use db:create-account to add a private planner.');
    const userId = randomUUID(),
      guildId = randomUUID();
    await tx.query('INSERT INTO users(id,username,password_hash) VALUES($1,$2,$3)', [
      userId,
      username,
      passwordHash,
    ]);
    await tx.query('INSERT INTO guilds(id,name,region,ruleset,faction) VALUES($1,$2,$3,$4,$5)', [
      guildId,
      workspace.name,
      workspace.region,
      workspace.ruleset,
      workspace.faction,
    ]);
    await tx.query("INSERT INTO guild_access(guild_id,user_id,role) VALUES($1,$2,'owner')", [
      guildId,
      userId,
    ]);
  });
}
export async function createPrivateAccount(
  db: Database,
  username: string,
  password: string,
  workspace: WorkspaceInput,
) {
  const input = accountCredentials.parse({ username, password });
  const settings = workspaceSchema.parse(workspace);
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    await tx.query('LOCK TABLE users IN EXCLUSIVE MODE');
    const existing = await tx.query('SELECT id FROM users WHERE lower(username)=$1', [
      input.username,
    ]);
    if (existing.rows.length)
      throw new Error('Account already exists. Its password and planner were not changed.');
    const userId = randomUUID(),
      guildId = randomUUID();
    await tx.query('INSERT INTO users(id,username,password_hash) VALUES($1,$2,$3)', [
      userId,
      input.username,
      passwordHash,
    ]);
    await tx.query('INSERT INTO guilds(id,name,region,ruleset,faction) VALUES($1,$2,$3,$4,$5)', [
      guildId,
      settings.name,
      settings.region,
      settings.ruleset,
      settings.faction,
    ]);
    await tx.query("INSERT INTO guild_access(guild_id,user_id,role) VALUES($1,$2,'owner')", [
      guildId,
      userId,
    ]);
    return { userId, guildId, username: input.username };
  });
}
