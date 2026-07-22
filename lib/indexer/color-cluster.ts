import { deltaE, isNeutral, NEAR_MISS_DELTA_E } from "./color-normalize";
import type { StyleClusterInput, StyleClusterMemberInput } from "./style-cluster-store";

export type ColorCount = { color: string; count: number };

// Greedy star clustering by usage: the most-used unassigned color anchors a
// cluster, every unassigned color within ΔE2000 < 6 radiates off it as a
// variant. This is the "brand color + accidental variants around it" shape from
// the design, and deliberately NOT transitive single-linkage — union-find would
// chain low-chroma grays into one giant blob. Neutral anchors are flagged so
// suspicion ranking downweights gray micro-variants (the dogfood learning).
// ponytail: O(n²) ΔE, fine at ~500 distinct colors; bucket by OKLCH lightness
// if a huge palette shows pain (design S7).
export function clusterColors(counts: ColorCount[]): StyleClusterInput[] {
  const sorted = [...counts].sort((a, b) => b.count - a.count || (a.color < b.color ? -1 : 1));
  const assigned = new Set<string>();
  const out: StyleClusterInput[] = [];

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

    const members: StyleClusterMemberInput[] = [
      { value: anchor.color, role: "canonical", distance: null, usageCount: anchor.count },
      ...variants.map((v) => ({
        value: v.color,
        role: "variant" as const,
        distance: deltaE(anchor.color, v.color),
        usageCount: v.count,
      })),
    ];
    const maxDistance = Math.max(...members.map((m) => m.distance ?? 0));
    out.push({
      key: anchor.color,
      canonical: anchor.color,
      size: members.length,
      neutral: isNeutral(anchor.color),
      maxDistance,
      members,
    });
  }

  return out;
}
