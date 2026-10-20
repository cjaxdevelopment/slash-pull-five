import './config.js';
import { MongoClient, ObjectId } from 'mongodb';
import { csvCell, csvHeaders, classes, classRoles } from '@spf/shared';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Read-only export. Never copies users, passwords, tokens, or client configuration.
const uri = process.env.LEGACY_MONGODB_URI;
const userId = process.env.LEGACY_USER_ID;
if (!uri || !userId || !ObjectId.isValid(userId))
  throw new Error('Set LEGACY_MONGODB_URI and LEGACY_USER_ID for the source roster owner.');
const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db();
  const players = await db
    .collection('players')
    .find(
      { userId: new ObjectId(userId) },
      { projection: { name: 1, class: 1, role: 1, spec: 1, offspec: 1, teamId: 1 } },
    )
    .toArray();
  const teams = await db
    .collection('teams')
    .find({ userId: new ObjectId(userId) }, { projection: { name: 1, description: 1 } })
    .toArray();
  const review = players.map((p) => {
    const supported = (classes as readonly string[]).includes(p.class);
    const role =
      p.role === 'dps'
        ? ['hunter', 'mage', 'priest', 'warlock'].includes(p.class)
          ? 'ranged'
          : 'melee'
        : p.role;
    return {
      legacyId: String(p._id),
      legacyName: p.name,
      legacyTeamId: p.teamId ? String(p.teamId) : null,
      supportedClass: supported,
      suggestedRole:
        supported && classRoles[p.class as (typeof classes)[number]].includes(role) ? role : '',
      requiredReview: [
        'Confirm character name',
        'Choose Forever spec and buff loadout',
        'Recheck build and raid role',
      ],
    };
  });
  const prefix = resolve(
    fileURLToPath(new URL('../../../', import.meta.url)),
    process.env.LEGACY_OUTPUT_PREFIX || '.local/legacy-roster',
  );
  await mkdir(dirname(prefix), { recursive: true });
  // Exclusive creation avoids overwriting any earlier export.
  await writeFile(
    `${prefix}.json`,
    JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), teams, players, review },
      null,
      2,
    ),
    { flag: 'wx', mode: 0o600 },
  );
  const lines = players
    .filter((p) => (classes as readonly string[]).includes(p.class))
    .map((p) =>
      [
        p.name,
        p.class,
        'custom',
        review.find((r) => r.legacyId === String(p._id))!.suggestedRole,
        '[]',
      ]
        .map(csvCell)
        .join(','),
    );
  await writeFile(`${prefix}.csv`, [csvHeaders.join(','), ...lines].join('\r\n'), {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(
    `Exported ${players.length} legacy characters and ${teams.length} teams. Review the JSON and complete missing CSV fields before import. Source database was not modified.`,
  );
} finally {
  await client.close();
}
