import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import { deltaE, NEAR_MISS_DELTA_E } from "@/lib/indexer/color-normalize";
import type { Db } from "../client";
import { styleClusterMembers, styleClusters, styleUsages } from "../schema";

// ── pure scorers (unit-tested without a DB) ─────────────────────────────────

const HIGH_PROPS = new Set(["color", "background", "background-color", "fill", "accent-color"]);
const LOW_PROPS = new Set([
  "border",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-block-color",
  "border-inline-color",
  "outline",
  "outline-color",
  "box-shadow",
  "text-shadow",
  "column-rule",
  "column-rule-color",
]);
const HIGH_TW = new Set(["bg", "text", "fill"]);

// Weight a single usage by how load-bearing its context is for brand identity:
// a background/fill color speaks louder than a border or shadow. Calibration
// knob (dogfood tunes it).
export function contextWeightFor(contextKind: string, contextDetail: string | null): number {
  switch (contextKind) {
    case "css-var-def":
      return 1.0;
    case "css-var-ref":
      return 0.8;
    case "css-decl": {
      const p = contextDetail?.toLowerCase() ?? "";
      if (HIGH_PROPS.has(p)) return 1.0;
      if (LOW_PROPS.has(p)) return 0.3;
      return 0.6;
    }
    case "tailwind-arbitrary":
      return HIGH_TW.has(contextDetail ?? "") ? 1.0 : 0.6;
    case "js-literal":
      return 0.6;
    default:
      return 0.5;
  }
}

function alphaFactor(alpha: number | null): number {
  return alpha != null && alpha < 1 ? 0.4 : 1;
}

export function brandScore(weightedUsage: number, distinctFileCount: number): number {
  return Math.log1p(weightedUsage) * distinctFileCount;
}

export function suspicionScore(input: {
  canonicalUsage: number;
  variantUsage: number;
  variantCount: number;
  maxDeltaE: number | null;
}): number {
  const dE = input.maxDeltaE ?? 0;
  return (
    Math.log1p(input.canonicalUsage) *
    Math.log1p(input.variantUsage + input.variantCount) *
    (1 / (0.5 + dE))
  );
}

export function coveragePct(tokenized: number, literal: number): number | null {
  const denom = tokenized + literal;
  return denom === 0 ? null : tokenized / denom;
}

// ── stats aggregate (one pass) + derivations ────────────────────────────────

export type ColorStat = {
  color: string;
  usageCount: number;
  distinctFileCount: number;
  weightedUsage: number;
  opaqueCount: number;
  score: number;
};

export type CoverageReport = {
  tokenized: number;
  literal: number;
  definitions: number;
  notScored: number;
  unresolvedVars: number;
  pct: number | null;
};

export type ColorStats = {
  perColor: ColorStat[];
  coverage: CoverageReport;
};

type Acc = { count: number; files: Set<string>; weighted: number; opaque: number };

function bump(
  map: Map<string, Acc>,
  color: string,
  weight: number,
  alpha: number | null,
  file: string,
) {
  let e = map.get(color);
  if (!e) {
    e = { count: 0, files: new Set(), weighted: 0, opaque: 0 };
    map.set(color, e);
  }
  e.count++;
  e.files.add(file);
  e.weighted += weight * alphaFactor(alpha);
  if (alpha == null || alpha >= 1) e.opaque++;
}

// Single GROUP-BY-in-memory pass over this source's color usages. Everything a
// human/agent reads (palette, most-used, one-offs, coverage) derives from this
// one object. var() references resolve against defined color vars: a ref counts
// as tokenized (and toward its color's usage) ONLY when it points at a var this
// index defines as a color — so `var(--space-4)` never inflates color coverage.
export function getColorStats(db: Db, sourceId: number): ColorStats {
  const rows = db
    .select({
      color: styleUsages.normalizedValue,
      contextKind: styleUsages.contextKind,
      contextDetail: styleUsages.contextDetail,
      alpha: styleUsages.alpha,
      relPath: styleUsages.relPath,
    })
    .from(styleUsages)
    .where(and(eq(styleUsages.sourceId, sourceId), eq(styleUsages.kind, "color")))
    .all();

  const byColor = new Map<string, Acc>();
  const definedVars = new Map<string, string>();
  const refOccurrences: { name: string; alpha: number | null; relPath: string }[] = [];
  let literal = 0;
  let definitions = 0;
  let notScored = 0;

  for (const r of rows) {
    if (r.contextKind === "css-var-ref") {
      if (r.contextDetail)
        refOccurrences.push({ name: r.contextDetail, alpha: r.alpha, relPath: r.relPath });
      continue;
    }
    if (r.contextKind === "tailwind-named") {
      notScored++;
      continue;
    }
    if (!r.color) continue;
    if (r.contextKind === "css-var-def") {
      definitions++;
      if (r.contextDetail) definedVars.set(r.contextDetail, r.color);
    } else {
      literal++;
    }
    bump(byColor, r.color, contextWeightFor(r.contextKind, r.contextDetail), r.alpha, r.relPath);
  }

  let tokenized = 0;
  let unresolvedVars = 0;
  const refWeight = contextWeightFor("css-var-ref", null);
  for (const ref of refOccurrences) {
    const color = definedVars.get(ref.name);
    if (!color) {
      unresolvedVars++;
      continue;
    }
    tokenized++;
    bump(byColor, color, refWeight, ref.alpha, ref.relPath);
  }

  const perColor: ColorStat[] = [...byColor.entries()].map(([color, e]) => ({
    color,
    usageCount: e.count,
    distinctFileCount: e.files.size,
    weightedUsage: e.weighted,
    opaqueCount: e.opaque,
    score: brandScore(e.weighted, e.files.size),
  }));

  return {
    perColor,
    coverage: {
      tokenized,
      literal,
      definitions,
      notScored,
      unresolvedVars,
      pct: coveragePct(tokenized, literal),
    },
  };
}

export type BrandColor = Pick<ColorStat, "color" | "usageCount" | "distinctFileCount" | "score">;

export function derivePalette(stats: ColorStats, topN = 24): BrandColor[] {
  return [...stats.perColor]
    .sort(
      (a, b) => b.score - a.score || b.usageCount - a.usageCount || (a.color < b.color ? -1 : 1),
    )
    .slice(0, topN)
    .map(({ color, usageCount, distinctFileCount, score }) => ({
      color,
      usageCount,
      distinctFileCount,
      score,
    }));
}

export function deriveMostUsed(stats: ColorStats, topN = 24): ColorStat[] {
  return [...stats.perColor]
    .sort((a, b) => b.usageCount - a.usageCount || (a.color < b.color ? -1 : 1))
    .slice(0, topN);
}

export function deriveOneOffs(stats: ColorStats): ColorStat[] {
  return stats.perColor.filter((c) => c.usageCount === 1);
}

// ── drift (suspicion-ranked near-miss clusters) ─────────────────────────────

export type DriftVariant = {
  color: string;
  usageCount: number;
  deltaE: number | null;
  file: string | null;
  line: number | null;
};

export type DriftFinding = {
  canonical: string;
  suggestedToken: string;
  neutral: boolean;
  suspicion: number;
  maxDeltaE: number | null;
  variants: DriftVariant[];
};

// One batched query for a representative file:line per color. Prefer a row with
// a non-null line (SVG rows have null), then a stable (relPath, line).
function representativeLocations(
  db: Db,
  sourceId: number,
  colors: string[],
): Map<string, { file: string; line: number | null }> {
  const best = new Map<string, { file: string; line: number | null }>();
  if (colors.length === 0) return best;
  const rows = db
    .select({
      color: styleUsages.normalizedValue,
      relPath: styleUsages.relPath,
      line: styleUsages.line,
    })
    .from(styleUsages)
    .where(
      and(
        eq(styleUsages.sourceId, sourceId),
        eq(styleUsages.kind, "color"),
        inArray(styleUsages.normalizedValue, colors),
      ),
    )
    .all();
  for (const r of rows) {
    if (!r.color) continue;
    const cur = best.get(r.color);
    const cand = { file: r.relPath, line: r.line };
    if (!cur || betterLocation(cand, cur)) best.set(r.color, cand);
  }
  return best;
}

function betterLocation(
  a: { file: string; line: number | null },
  b: { file: string; line: number | null },
): boolean {
  const aHas = a.line != null;
  const bHas = b.line != null;
  if (aHas !== bHas) return aHas;
  if (a.file !== b.file) return a.file < b.file;
  return (a.line ?? 0) < (b.line ?? 0);
}

// For each canonical color, pick the var that DEFINES it and is most REFERENCED
// (recorded E2 tie-break). Returns hex fallback via absence (caller defaults).
function bestVarByColor(db: Db, sourceId: number, colors: string[]): Map<string, string> {
  const out = new Map<string, string>();
  if (colors.length === 0) return out;
  const defs = db
    .select({ name: styleUsages.contextDetail, color: styleUsages.normalizedValue })
    .from(styleUsages)
    .where(
      and(
        eq(styleUsages.sourceId, sourceId),
        eq(styleUsages.kind, "color"),
        eq(styleUsages.contextKind, "css-var-def"),
        isNotNull(styleUsages.contextDetail),
        inArray(styleUsages.normalizedValue, colors),
      ),
    )
    .all();
  if (defs.length === 0) return out;
  const names = defs.map((d) => d.name).filter((n): n is string => !!n);
  const refCount = new Map<string, number>();
  if (names.length > 0) {
    const refs = db
      .select({ name: styleUsages.contextDetail, n: count() })
      .from(styleUsages)
      .where(
        and(
          eq(styleUsages.sourceId, sourceId),
          eq(styleUsages.kind, "color"),
          eq(styleUsages.contextKind, "css-var-ref"),
          inArray(styleUsages.contextDetail, names),
        ),
      )
      .groupBy(styleUsages.contextDetail)
      .all();
    for (const r of refs) if (r.name) refCount.set(r.name, Number(r.n));
  }
  const bestRefs = new Map<string, number>();
  for (const d of defs) {
    if (!d.color || !d.name) continue;
    const rc = refCount.get(d.name) ?? 0;
    if (!out.has(d.color) || rc > (bestRefs.get(d.color) ?? -1)) {
      out.set(d.color, d.name);
      bestRefs.set(d.color, rc);
    }
  }
  return out;
}

export function listColorDrift(db: Db, sourceId: number): DriftFinding[] {
  const clusterRows = db
    .select()
    .from(styleClusters)
    .where(and(eq(styleClusters.sourceId, sourceId), eq(styleClusters.kind, "color")))
    .all();
  if (clusterRows.length === 0) return [];

  const memberRows = db
    .select()
    .from(styleClusterMembers)
    .where(
      inArray(
        styleClusterMembers.clusterId,
        clusterRows.map((c) => c.id),
      ),
    )
    .all();

  const byCluster = new Map<number, typeof memberRows>();
  for (const m of memberRows) {
    const list = byCluster.get(m.clusterId) ?? [];
    list.push(m);
    byCluster.set(m.clusterId, list);
  }

  const variantColors = memberRows.filter((m) => m.role === "variant").map((m) => m.value);
  const locByColor = representativeLocations(db, sourceId, variantColors);
  const bestVar = bestVarByColor(
    db,
    sourceId,
    clusterRows.map((c) => c.canonical),
  );

  const findings: DriftFinding[] = [];
  for (const c of clusterRows) {
    const members = byCluster.get(c.id) ?? [];
    const canonical = members.find((m) => m.role === "canonical");
    const variants = members.filter((m) => m.role === "variant");
    if (!canonical || variants.length === 0) continue;
    const variantUsage = variants.reduce((s, v) => s + v.usageCount, 0);
    findings.push({
      canonical: c.canonical,
      suggestedToken: bestVar.get(c.canonical) ?? c.canonical,
      neutral: c.neutral,
      suspicion: suspicionScore({
        canonicalUsage: canonical.usageCount,
        variantUsage,
        variantCount: variants.length,
        maxDeltaE: c.maxDistance,
      }),
      maxDeltaE: c.maxDistance,
      variants: variants.map((v) => {
        const loc = locByColor.get(v.value);
        return {
          color: v.value,
          usageCount: v.usageCount,
          deltaE: v.distance,
          file: loc?.file ?? null,
          line: loc?.line ?? null,
        };
      }),
    });
  }

  findings.sort((a, b) => Number(a.neutral) - Number(b.neutral) || b.suspicion - a.suspicion);
  return findings;
}

// ── token resolution (resolve_token_for_value) ──────────────────────────────

export type TokenCandidate = { color: string; token: string | null };

export type ResolveResult =
  | { within: true; token: string | null; value: string; deltaE: number }
  | { within: false; nearest: string | null; deltaE: number | null };

// Every css-var-def color, deterministically ordered so resolution ties and
// byte-stable outputs never depend on DB row order.
export function listDefinedColorTokens(db: Db, sourceId: number): TokenCandidate[] {
  const rows = db
    .select({ token: styleUsages.contextDetail, color: styleUsages.normalizedValue })
    .from(styleUsages)
    .where(
      and(
        eq(styleUsages.sourceId, sourceId),
        eq(styleUsages.kind, "color"),
        eq(styleUsages.contextKind, "css-var-def"),
        isNotNull(styleUsages.contextDetail),
        isNotNull(styleUsages.normalizedValue),
      ),
    )
    .all();
  const seen = new Set<string>();
  const out: TokenCandidate[] = [];
  for (const r of rows) {
    if (!r.token || !r.color) continue;
    const key = `${r.token} ${r.color}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ token: r.token, color: r.color });
  }
  out.sort((a, b) => cmp(a.color, b.color) || cmp(a.token ?? "", b.token ?? ""));
  return out;
}

// Union of the derived palette and every defined token. A defined-but-low-usage
// token is not in the top-N palette, so a palette-only search would miss it and
// return a nearby popular color instead — the union keeps exact tokens winnable.
export function getResolveCandidates(db: Db, sourceId: number): TokenCandidate[] {
  const stats = getColorStats(db, sourceId);
  const palette = derivePalette(stats);
  const defined = listDefinedColorTokens(db, sourceId);
  const tokenByColor = new Map<string, string>();
  for (const d of defined)
    if (d.token && !tokenByColor.has(d.color)) tokenByColor.set(d.color, d.token);
  const seen = new Set<string>();
  const out: TokenCandidate[] = [];
  const push = (color: string, token: string | null) => {
    const key = `${color} ${token ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ color, token });
  };
  for (const d of defined) push(d.color, d.token);
  for (const p of palette) push(p.color, tokenByColor.get(p.color) ?? null);
  return out;
}

// Nearest candidate by ΔE2000. Pre-sorted so equal distances break toward a
// defined token, then by color; the first strict minimum wins.
export function resolveColorToken(target: string, candidates: TokenCandidate[]): ResolveResult {
  const sorted = [...candidates].sort(
    (a, b) => (a.token !== null ? 0 : 1) - (b.token !== null ? 0 : 1) || cmp(a.color, b.color),
  );
  let best: { c: TokenCandidate; d: number } | null = null;
  for (const c of sorted) {
    const d = deltaE(target, c.color);
    if (best === null || d < best.d) best = { c, d };
  }
  if (best === null) return { within: false, nearest: null, deltaE: null };
  if (best.d < NEAR_MISS_DELTA_E) {
    return { within: true, token: best.c.token, value: best.c.color, deltaE: best.d };
  }
  return { within: false, nearest: best.c.color, deltaE: best.d };
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
