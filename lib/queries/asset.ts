"use client";

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { AssetDetail, UsageRow } from "../db/queries/asset-detail";
import { apiGet } from "./client";
import { qk } from "./keys";

export function useAsset(id: number | null) {
  return useQuery({
    queryKey: id !== null ? qk.asset(id) : ["asset", "none"],
    queryFn: () => apiGet<AssetDetail>(`/api/assets/${id}`),
    enabled: id !== null,
    placeholderData: keepPreviousData,
  });
}

type UsagePage = UsageRow[];

export function useAssetUsages(id: number | null, limit = 50) {
  return useInfiniteQuery({
    queryKey: id !== null ? qk.usages(id) : ["asset", "none", "usages"],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (pageParam !== null) params.set("cursor", String(pageParam));
      return apiGet<UsagePage>(`/api/assets/${id}/usages?${params.toString()}`);
    },
    getNextPageParam: (last) =>
      last.length === limit ? (last[last.length - 1]?.id ?? null) : null,
    enabled: id !== null,
    placeholderData: keepPreviousData,
  });
}
