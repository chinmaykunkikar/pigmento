const KNOWN_PIXEL_SIZES = new Set([
  8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96, 128, 256,
]);

const PIXEL_SUFFIX_RE = /[-_](\d{2,3})$/;
const TSHIRT_SUFFIX_RE = /[-_](xs|sm|md|lg|xl|xxl|small|medium|large)$/i;
const PIXEL_PATH_SEG_RE = /(?:^|\/)(\d{2,3})(?:\/|$)/;
const TSHIRT_PATH_SEG_RE = /(?:^|\/)(xs|sm|md|lg|xl|xxl|small|medium|large)(?:\/|$)/i;

export type SizeSuffix = { canonical: string; size: number } | null;

export function parsePixelSuffix(stem: string): SizeSuffix {
  const m = stem.match(PIXEL_SUFFIX_RE);
  if (!m) return null;
  const n = Number.parseInt(m[1] ?? "", 10);
  if (!KNOWN_PIXEL_SIZES.has(n)) return null;
  return { canonical: stem.slice(0, -m[0].length), size: n };
}

export function hasTshirtSignal(stem: string, dir: string): boolean {
  return TSHIRT_SUFFIX_RE.test(stem) || TSHIRT_PATH_SEG_RE.test(dir);
}

export function hasPixelPathSignal(dir: string): boolean {
  return PIXEL_PATH_SEG_RE.test(dir);
}

export function pixelSizeFromPath(dir: string): number | null {
  const m = dir.match(PIXEL_PATH_SEG_RE);
  if (!m) return null;
  const n = Number.parseInt(m[1] ?? "", 10);
  return KNOWN_PIXEL_SIZES.has(n) ? n : null;
}
