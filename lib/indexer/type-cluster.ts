import type { StyleClusterInput, StyleClusterMemberInput } from "./style-cluster-store";
import type { TypeAxis } from "./type-normalize";

export type TypeValueCount = { axis: TypeAxis; value: string; count: number };

// Sizes within 1px are near-misses ONLY when strictly less-used than the anchor:
// equal-popularity sizes and integer scale steps (13/14/16) are intentional, so
// the strict `< 1` px window + strictly-less-used rule keep them apart while
// fractional drift (13 vs 13.5, rem-rounding) still clusters (codex C7).
const SIZE_NEAR_PX = 1;

// px diffs come from rem/pt conversions, so round off float noise (0.400..036).
function pxDistance(a: number, b: number): number {
  return Math.round(Math.abs(a - b) * 1000) / 1000;
}

function clusterSizes(sizes: TypeValueCount[]): StyleClusterInput[] {
  const withPx = sizes
    .map((s) => ({ ...s, px: Number(s.value) }))
    .filter((s) => Number.isFinite(s.px));
  const sorted = [...withPx].sort((a, b) => b.count - a.count || a.px - b.px);
  const assigned = new Set<string>();
  const out: StyleClusterInput[] = [];

  for (const anchor of sorted) {
    if (assigned.has(anchor.value)) continue;
    assigned.add(anchor.value);

    const variants = sorted.filter(
      (o) =>
        !assigned.has(o.value) &&
        o.count < anchor.count &&
        Math.abs(o.px - anchor.px) < SIZE_NEAR_PX,
    );
    if (variants.length === 0) continue;
    for (const v of variants) assigned.add(v.value);

    const members: StyleClusterMemberInput[] = [
      { value: anchor.value, role: "canonical", distance: null, usageCount: anchor.count },
      ...variants.map((v) => ({
        value: v.value,
        role: "variant" as const,
        distance: pxDistance(v.px, anchor.px),
        usageCount: v.count,
      })),
    ];
    out.push({
      key: `size:${anchor.value}`,
      canonical: anchor.value,
      size: members.length,
      maxDistance: Math.max(...members.map((m) => m.distance ?? 0)),
      params: { axis: "size", metric: "px" },
      members,
    });
  }
  return out;
}

function firstFamily(stack: string): string {
  return stack.split(",")[0]?.trim() ?? stack;
}

// Same first family, differing fallback tails = drift (`Inter, sans-serif` vs
// `Inter, Arial, sans-serif`). A first family with a single stack is not drift.
function clusterFamilies(families: TypeValueCount[]): StyleClusterInput[] {
  const byFirst = new Map<string, TypeValueCount[]>();
  for (const f of families) {
    const first = firstFamily(f.value);
    const list = byFirst.get(first) ?? [];
    list.push(f);
    byFirst.set(first, list);
  }

  const out: StyleClusterInput[] = [];
  for (const [first, group] of byFirst) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1));
    const canonical = sorted[0];
    if (!canonical) continue;
    const members: StyleClusterMemberInput[] = sorted.map((v, i) => ({
      value: v.value,
      role: i === 0 ? "canonical" : "variant",
      distance: null,
      usageCount: v.count,
    }));
    out.push({
      key: `family:${first}`,
      canonical: canonical.value,
      size: members.length,
      params: { axis: "family", metric: "stack" },
      members,
    });
  }
  return out;
}

// weight and line-height are exact-only in v1 (0E named only size + family
// near-miss); their exact groups are aggregates for the insight slice.
export function clusterTypography(counts: TypeValueCount[]): StyleClusterInput[] {
  return [
    ...clusterSizes(counts.filter((c) => c.axis === "size")),
    ...clusterFamilies(counts.filter((c) => c.axis === "family")),
  ];
}
