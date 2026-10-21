import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { it, expect } from 'vitest';
import { acquireLocalDatabaseLock } from './local-lock.js';

it('rejects a second local database process, reclaims a dead holder, and releases only its own lock', async () => {
  const base = resolve(tmpdir());
  const directory = await mkdtemp(resolve(base, 'spf-local-lock-'));
  const database = resolve(directory, 'postgres');
  let release: undefined | (() => Promise<void>);
  try {
    release = await acquireLocalDatabaseLock(database);
    await expect(acquireLocalDatabaseLock(database)).rejects.toThrow('already in use');
    await release();
    await writeFile(
      database + '.spf-lock',
      JSON.stringify({ pid: 2147483647, instance: 'dead-process' }),
    );
    release = await acquireLocalDatabaseLock(database);
    expect(JSON.parse(await readFile(database + '.spf-lock', 'utf8')).pid).toBe(process.pid);
    await writeFile(
      database + '.spf-lock',
      JSON.stringify({ pid: process.pid, instance: 'different-owner' }),
    );
    await release();
    expect(JSON.parse(await readFile(database + '.spf-lock', 'utf8')).instance).toBe(
      'different-owner',
    );
  } finally {
    await release?.();
    if (!directory.startsWith(base + sep)) throw new Error('Unexpected temporary cleanup path.');
    await rm(directory, { recursive: true, force: true });
  }
});
