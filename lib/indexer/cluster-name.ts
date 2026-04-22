const STRIP_SUFFIX =
  /-(?:outline|filled|bold|regular|duotone|sm|md|lg|xl|xxl|16|20|24|28|32|40|48|56|64|circle|square|solid|light|thin|rounded)(?=-|$)/gi;
const STRIP_PREFIX = /^(?:ic|icon)-/i;

export function canonicalStem(stem: string): string {
  const lower = stem.toLowerCase();
  let s = lower.replace(STRIP_PREFIX, "");
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(STRIP_SUFFIX, "");
  }
  return s || lower;
}

export type NameCluster = {
  key: string;
  memberIds: number[];
  canonicalId: number;
};

export function nameCluster(items: { id: number; stem: string }[]): NameCluster[] {
  const byKey = new Map<string, { id: number; stem: string }[]>();
  for (const it of items) {
    const key = canonicalStem(it.stem);
    const list = byKey.get(key) ?? [];
    list.push(it);
    byKey.set(key, list);
  }

  const out: NameCluster[] = [];
  for (const [key, members] of byKey) {
    if (members.length < 2) continue;
    members.sort((a, b) => a.stem.length - b.stem.length || a.stem.localeCompare(b.stem));
    const canonicalId = members[0]?.id;
    if (!canonicalId) continue;
    out.push({ key, memberIds: members.map((m) => m.id), canonicalId });
  }
  return out;
}
