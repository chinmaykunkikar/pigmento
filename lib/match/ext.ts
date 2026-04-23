const ALLOWED = new Set(["svg", "png", "jpg", "jpeg", "webp", "gif"]);

export function normalizeExt(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "";
  const raw = name.slice(idx + 1).toLowerCase();
  return raw === "jpeg" ? "jpg" : raw;
}

export function isAllowedExt(name: string): boolean {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return false;
  return ALLOWED.has(name.slice(idx + 1).toLowerCase());
}

import type { SvgStats } from "@/lib/indexer/svg";

export type { SvgStats };

export type QuerySignature = {
  name: string;
  stem: string;
  ext: string;
  size: number;
  sha1: string;
  contentHash: string;
  phash: string | null;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  svg: SvgStats | null;
};
