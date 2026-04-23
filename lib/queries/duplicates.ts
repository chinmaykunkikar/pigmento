"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ExactDuplicates, NearDuplicates } from "../db/queries/duplicates";
import { apiGet } from "./client";
import { qk } from "./keys";

export function useExactDuplicates(sourceId: number | null, folder?: string) {
  const scopedFolder = folder && folder.length > 0 ? folder : "";
  return useQuery({
    queryKey:
      sourceId !== null
        ? [...qk.duplicates("exact"), sourceId, scopedFolder]
        : ["duplicates", "exact", "none"],
    queryFn: () => {
      const params = new URLSearchParams({ sourceId: String(sourceId), mode: "exact" });
      if (scopedFolder) params.set("folder", scopedFolder);
      return apiGet<ExactDuplicates>(`/api/duplicates?${params.toString()}`);
    },
    enabled: sourceId !== null,
    placeholderData: keepPreviousData,
  });
}

export function useNearDuplicates(sourceId: number | null, folder?: string) {
  const scopedFolder = folder && folder.length > 0 ? folder : "";
  return useQuery({
    queryKey:
      sourceId !== null
        ? [...qk.duplicates("near"), sourceId, scopedFolder]
        : ["duplicates", "near", "none"],
    queryFn: () => {
      const params = new URLSearchParams({ sourceId: String(sourceId), mode: "near" });
      if (scopedFolder) params.set("folder", scopedFolder);
      return apiGet<NearDuplicates>(`/api/duplicates?${params.toString()}`);
    },
    enabled: sourceId !== null,
    placeholderData: keepPreviousData,
  });
}
