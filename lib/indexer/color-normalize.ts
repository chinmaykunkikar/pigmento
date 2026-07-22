import { converter, differenceCiede2000, formatHex, parse } from "culori";

// ΔE2000 near-miss suspicion threshold — the design-committed clustering
// constant. Calibrated during dogfood; do not swap for Euclidean OKLab distance
// (its ~0-1 scale makes "6" meaningless).
export const NEAR_MISS_DELTA_E = 6;

// OKLCH chroma below this reads as a neutral (gray, off-white, warm paper). The
// cohort-live-web spike showed near-miss lists drown in low-chroma gray
// micro-variants, so clusters anchored on a neutral get flagged for downweight.
// ponytail: 0.025 separates teal (0.084) from paper (0.006)/gray (0.0); dogfood
// recalibrates the knob.
export const NEUTRAL_MAX_CHROMA = 0.025;

const toOklch = converter("oklch");
const ciede2000 = differenceCiede2000();

export type Normalized = { color: string; alpha: number | null };

// Any CSS color string -> canonical #rrggbb base + separate alpha. Alpha is
// split off so #ff000080 and #ff0000 share one base and cluster as a variant
// family, not drift. Returns null for anything culori can't resolve (var(),
// color-mix(), SCSS $vars, garbage): unresolved tokens, counted in coverage but
// never clustered.
export function normalizeColor(raw: string): Normalized | null {
  const parsed = parse(raw);
  if (!parsed) return null;
  const alpha = typeof parsed.alpha === "number" ? parsed.alpha : null;
  return { color: formatHex(parsed), alpha };
}

export function chromaOf(color: string): number {
  return toOklch(color)?.c ?? 0;
}

export function isNeutral(color: string): boolean {
  return chromaOf(color) < NEUTRAL_MAX_CHROMA;
}

export function deltaE(a: string, b: string): number {
  return ciede2000(a, b);
}
