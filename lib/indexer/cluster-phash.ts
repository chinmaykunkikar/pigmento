import { hamming } from "./phash";

export type PhashCluster = {
  key: string;
  canonicalId: number;
  members: { id: number; hamming: number }[];
};

type Item = { id: number; ext: string; phash: string };

const SVG_THRESHOLD = 8;
const MIN_ENTROPY = 12;
const MAX_ENTROPY = 52;

function popcountHex(hex: string): number {
  let n = BigInt(`0x${hex}`);
  let c = 0;
  while (n) {
    c += Number(n & 1n);
    n >>= 1n;
  }
  return c;
}

function thresholdFor(ext: string, defaultMax: number): number {
  return ext === "svg" ? Math.min(defaultMax, SVG_THRESHOLD) : defaultMax;
}

export function phashCluster(items: Item[], maxHamming: number): PhashCluster[] {
  const byExt = new Map<string, Item[]>();
  for (const it of items) {
    if (!it.phash) continue;
    const entropy = popcountHex(it.phash);
    if (entropy < MIN_ENTROPY || entropy > MAX_ENTROPY) continue;
    const bucket = byExt.get(it.ext) ?? [];
    bucket.push(it);
    byExt.set(it.ext, bucket);
  }

  const parent = new Map<number, number>();
  const pairwise = new Map<string, number>();

  function find(x: number): number {
    let r = x;
    while (true) {
      const p = parent.get(r);
      if (p === undefined || p === r) break;
      r = p;
    }
    let n = x;
    while (n !== r) {
      const p = parent.get(n);
      if (p === undefined) break;
      parent.set(n, r);
      n = p;
    }
    return r;
  }

  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  function key(a: number, b: number): string {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }

  for (const [ext, bucket] of byExt) {
    const threshold = thresholdFor(ext, maxHamming);
    for (const it of bucket) parent.set(it.id, it.id);
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i];
        const b = bucket[j];
        if (!a || !b) continue;
        const h = hamming(a.phash, b.phash);
        if (h <= threshold) {
          union(a.id, b.id);
          pairwise.set(key(a.id, b.id), h);
        }
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    const list = groups.get(root) ?? [];
    list.push(id);
    groups.set(root, list);
  }

  const phashById = new Map<number, string>();
  for (const it of items) phashById.set(it.id, it.phash);

  const out: PhashCluster[] = [];
  for (const [root, ids] of groups) {
    if (ids.length < 2) continue;

    const canonicalId = pickMedoid(ids, phashById);
    if (canonicalId === null) continue;
    const canonicalPhash = phashById.get(canonicalId);
    if (!canonicalPhash) continue;

    const members = ids
      .map((id) => {
        if (id === canonicalId) return { id, hamming: 0 };
        const p = phashById.get(id);
        if (!p) return null;
        return { id, hamming: hamming(canonicalPhash, p) };
      })
      .filter((m): m is { id: number; hamming: number } => m !== null);

    members.sort((a, b) => a.hamming - b.hamming);
    out.push({ key: `phash-${root}`, canonicalId, members });
  }
  return out;
}

function pickMedoid(ids: number[], phashById: Map<number, string>): number | null {
  let best: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of ids) {
    const cp = phashById.get(candidate);
    if (!cp) continue;
    let score = 0;
    for (const other of ids) {
      if (other === candidate) continue;
      const op = phashById.get(other);
      if (op) score += hamming(cp, op);
    }
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}
