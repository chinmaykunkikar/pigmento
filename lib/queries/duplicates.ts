"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ExactDuplicates, NearDuplicates } from "../db/queries/duplicates";
import { apiGet } from "./client";
import { qk } from "./keys";

export function useExactDuplicates(sourceId: number | null) {
  return useQuery({
    queryKey:
      sourceId !== null ? [...qk.duplicates("exact"), sourceId] : ["duplicates", "exact", "none"],
    queryFn: () => apiGet<ExactDuplicates>(`/api/duplicates?sourceId=${sourceId}&mode=exact`),
    enabled: sourceId !== null,
    placeholderData: keepPreviousData,
  });
}

export function useNearDuplicates(sourceId: number | null) {
  return useQuery({
    queryKey:
      sourceId !== null ? [...qk.duplicates("near"), sourceId] : ["duplicates", "near", "none"],
    queryFn: () => apiGet<NearDuplicates>(`/api/duplicates?sourceId=${sourceId}&mode=near`),
    enabled: sourceId !== null,
    placeholderData: keepPreviousData,
  });
}
