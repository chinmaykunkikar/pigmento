import { createHash } from "node:crypto";
import xxhash from "xxhash-wasm";

type Hasher = Awaited<ReturnType<typeof xxhash>>;

let hasher: Hasher | null = null;

async function getHasher(): Promise<Hasher> {
  if (!hasher) hasher = await xxhash();
  return hasher;
}

export async function hashBuffer(buf: Buffer): Promise<{ content: string; sha1: string }> {
  const h = await getHasher();
  const content = h.h64Raw(new Uint8Array(buf)).toString(16).padStart(16, "0");
  const sha1 = createHash("sha1").update(buf).digest("hex");
  return { content, sha1 };
}
