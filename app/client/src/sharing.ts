import {
  makeSharedRaid,
  sharedRaidSchema,
  type Character,
  type Plan,
  type SharedRaid,
} from '@spf/shared';
const limit = 100_000;
async function bytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error('This raid link is too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
export async function raidShareLink(plan: Plan, characters: Character[]): Promise<string> {
  const json = JSON.stringify(makeSharedRaid(plan, characters));
  const data = await bytes(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate')));
  const encoded = btoa(Array.from(data, (b) => String.fromCharCode(b)).join(''))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  return location.origin + '/share#v1.' + encoded;
}
export async function readRaidLink(hash: string): Promise<SharedRaid> {
  if (hash.length > 65_000 || !/^#v1\.[a-zA-Z0-9_-]+$/.test(hash))
    throw new Error('This raid link is invalid or unsupported.');
  let encoded = hash.slice(4).replaceAll('-', '+').replaceAll('_', '/');
  encoded += '='.repeat((4 - (encoded.length % 4)) % 4);
  const data = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const raw = await bytes(
    new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate')),
  );
  return sharedRaidSchema.parse(JSON.parse(new TextDecoder().decode(raw)));
}
