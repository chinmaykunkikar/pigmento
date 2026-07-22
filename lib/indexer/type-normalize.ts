export type TypeAxis = "size" | "family" | "weight" | "line-height";

// font-size / line-height length normalized to px at a 16px root (0E). Returns
// null for %/ex/ch/viewport units: unresolvable literal-only gaps, recorded raw.
export function normalizeSize(raw: string): number | null {
  const m = raw.trim().match(/^(-?\d*\.?\d+)(px|rem|em|pt)?$/i);
  if (!m || m[1] === undefined) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  switch ((m[2] ?? "px").toLowerCase()) {
    case "px":
      return n;
    case "rem":
    case "em":
      return n * 16;
    case "pt":
      return n * (4 / 3);
    default:
      return null;
  }
}

const WEIGHT_KEYWORDS: Record<string, number> = { normal: 400, bold: 700 };

// keyword or numeric weight -> number. lighter/bolder are relative -> null.
export function normalizeWeight(raw: string): number | null {
  const v = raw.trim().toLowerCase();
  if (v in WEIGHT_KEYWORDS) return WEIGHT_KEYWORDS[v] ?? null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : null;
}

// unitless line-height stays a raw ratio (0E exempt); a length is normalized to
// px like a size and marked non-unitless so mixed forms still compare.
export function normalizeLineHeight(raw: string): string | null {
  const v = raw.trim();
  if (/^\d*\.?\d+$/.test(v)) {
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : null;
  }
  const px = normalizeSize(v);
  return px != null ? `${px}px` : null;
}

// font-family stack -> lowercased, quote-stripped, comma-joined; plus the first
// family for fallback-tail clustering.
export function normalizeFamily(raw: string): { stack: string; first: string } | null {
  const parts = raw
    .split(",")
    .map((f) =>
      f
        .trim()
        .replace(/^['"]|['"]$/g, "")
        .toLowerCase(),
    )
    .filter(Boolean);
  const first = parts[0];
  if (!first) return null;
  return { stack: parts.join(", "), first };
}

// The normalized grouping key for a value on a given axis (string for the
// generic normalized_value column), or null when unresolvable.
export function normalizeByAxis(axis: TypeAxis, raw: string): string | null {
  switch (axis) {
    case "size": {
      const px = normalizeSize(raw);
      return px != null ? String(px) : null;
    }
    case "weight": {
      const w = normalizeWeight(raw);
      return w != null ? String(w) : null;
    }
    case "line-height":
      return normalizeLineHeight(raw);
    case "family":
      return normalizeFamily(raw)?.stack ?? null;
  }
}
