import type { Category } from "./types";

export function categorize(ext: string, width: number | null, height: number | null): Category {
  if (ext === "svg") {
    if (width !== null && height !== null && width <= 64 && height <= 64) return "icon";
    return "illustration";
  }
  if (width === null || height === null) return "other";
  const max = Math.max(width, height);
  if (max <= 64) return "icon";
  if (max <= 512) return "illustration";
  return "photo";
}
