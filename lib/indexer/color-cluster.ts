import { deltaE, isNeutral, NEAR_MISS_DELTA_E } from "./color-normalize";

export type StyleClusterMember = {
  color: string;
  role: "canonical" | "variant";
  deltaE: number | null;
  usageCount: number;
};

export type NearMissCluster = {
  key: string;
  canonical: string;
  size: number;
  neutral: boolean;
  maxDeltaE: number;
  members: StyleClusterMember[];
};

export type ColorCount = { color: string; count: number };

// Greedy star clustering by usage: the most-used unassigned color anchors a
// cluster, every unassigned color within ΔE2000 < 6 radiates off it as a
// variant. This is the "brand color + accidental variants around it" shape from
// the design, and deliberately NOT transitive single-linkage — union-find would
// chain low-chroma grays into one giant blob. Neutral anchors are flagged so
// suspicion ranking downweights gray micro-variants (the dogfood learning).
// ponytail: O(n²) ΔE, fine at ~500 distinct colors; bucket by OKLCH lightness
// if a huge palette shows pain (design S7).
export function clusterColors(counts: ColorCount[]): NearMissCluster[] {
  const sorted = [...counts].sort((a, b) => b.count - a.count || (a.color < b.color ? -1 : 1));
  const assigned = new Set<string>();
  const out: NearMissCluster[] = [];

  for (const anchor of sorted) {
    if (assigned.has(anchor.color)) continue;
    assigned.add(anchor.color);

    const variants: ColorCount[] = [];
    for (const other of sorted) {
      if (assigned.has(other.color)) continue;
      if (deltaE(anchor.color, other.color) < NEAR_MISS_DELTA_E) {
        variants.push(other);
        assigned.add(other.color);
      }
    }
    if (variants.length === 0) continue;

    const members: StyleClusterMember[] = [
      { color: anchor.color, role: "canonical", deltaE: null, usageCount: anchor.count },
      ...variants.map((v) => ({
        color: v.color,
        role: "variant" as const,
        deltaE: deltaE(anchor.color, v.color),
        usageCount: v.count,
      })),
    ];
    const maxDeltaE = Math.max(...members.map((m) => m.deltaE ?? 0));
    out.push({
      key: anchor.color,
      canonical: anchor.color,
      size: members.length,
      neutral: isNeutral(anchor.color),
      maxDeltaE,
      members,
    });
  }

  return out;
}
