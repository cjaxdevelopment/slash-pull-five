import { open, readFile, unlink, mkdir, rmdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

interface Holder {
  pid: number;
  instance: string;
}
const live = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
};
async function readHolder(path: string): Promise<Holder | null> {
  try {
    const record = JSON.parse(await readFile(path, 'utf8')) as Holder;
    return Number.isInteger(record.pid) && record.pid > 0 && typeof record.instance === 'string'
      ? record
      : null;
  } catch {
    return null;
  }
}
// PGlite's NodeFS must never be shared by two server/CLI processes.
export async function acquireLocalDatabaseLock(directory: string) {
  const path = directory + '.spf-lock';
  const claim = path + '.claim';
  const holder = { pid: process.pid, instance: randomUUID() };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const file = await open(path, 'wx', 0o600);
      try {
        await file.writeFile(JSON.stringify(holder));
      } finally {
        await file.close();
      }
      return async () => {
        if ((await readHolder(path))?.instance === holder.instance)
          await unlink(path).catch(() => {});
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const seen = await readHolder(path);
    if (!seen || live(seen.pid))
      throw new Error(
        'The local database is already in use or starting. Stop the other API/CLI process before opening it again.',
      );
    try {
      await mkdir(claim);
    } catch {
      throw new Error(
        'Another process is checking the local database lock. Retry after it finishes.',
      );
    }
    try {
      const current = await readHolder(path);
      if (current && !live(current.pid)) await unlink(path);
    } finally {
      await rmdir(claim);
    }
  }
  throw new Error(
    'Could not acquire the local database lock. Stop other API/CLI processes and retry.',
  );
}
