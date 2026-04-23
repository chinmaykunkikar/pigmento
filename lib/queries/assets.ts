"use client";

import type { AssetRef } from "@/lib/plan/schema";
import { apiGet } from "./client";

export async function fetchAssetRefs(ids: readonly number[]): Promise<AssetRef[]> {
  if (ids.length === 0) return [];
  const params = new URLSearchParams({ ids: ids.join(",") });
  return apiGet<AssetRef[]>(`/api/assets/refs?${params.toString()}`);
}
