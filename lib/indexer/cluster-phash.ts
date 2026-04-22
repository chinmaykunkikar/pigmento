import { hamming } from "./phash";

export type PhashCluster = {
  key: string;
  canonicalId: number;
  members: { id: number; hamming: number }[];
};

type Item = { id: number; ext: string; phash: string };

export function phashCluster(items: Item[], maxHamming: number): PhashCluster[] {
  const byExt = new Map<string, Item[]>();
  for (const it of items) {
    if (!it.phash) continue;
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

  for (const bucket of byExt.values()) {
    for (const it of bucket) parent.set(it.id, it.id);
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i];
        const b = bucket[j];
        if (!a || !b) continue;
        const h = hamming(a.phash, b.phash);
        if (h <= maxHamming) {
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

  const out: PhashCluster[] = [];
  for (const [root, ids] of groups) {
    if (ids.length < 2) continue;
    ids.sort((a, b) => a - b);
    const canonicalId = ids[0];
    if (canonicalId === undefined) continue;
    const members = ids.map((id) => ({
      id,
      hamming: id === canonicalId ? 0 : (pairwise.get(key(canonicalId, id)) ?? -1),
    }));
    out.push({ key: `phash-${root}`, canonicalId, members });
  }
  return out;
}
