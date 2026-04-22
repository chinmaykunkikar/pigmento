export type HashCluster = {
  key: string;
  memberIds: number[];
  canonicalId: number;
};

export function hashCluster(
  items: { id: number; contentHash: string; relPath: string }[],
): HashCluster[] {
  const byHash = new Map<string, typeof items>();
  for (const it of items) {
    const list = byHash.get(it.contentHash) ?? [];
    list.push(it);
    byHash.set(it.contentHash, list);
  }
  const out: HashCluster[] = [];
  for (const [key, members] of byHash) {
    if (members.length < 2) continue;
    members.sort((a, b) => a.relPath.localeCompare(b.relPath));
    const canonicalId = members[0]?.id;
    if (!canonicalId) continue;
    out.push({ key, memberIds: members.map((m) => m.id), canonicalId });
  }
  return out;
}
