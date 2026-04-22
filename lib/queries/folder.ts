"use client";

import { useQuery } from "@tanstack/react-query";
import type { AssetSummary } from "../db/queries/folders";
import { apiGet } from "./client";
import { qk } from "./keys";

export function useFolder(sourceId: number | null, path: string | null) {
  return useQuery({
    queryKey: sourceId !== null ? qk.folder(`${sourceId}:${path ?? "*"}`) : ["folder", "none"],
    queryFn: () => {
      const params = new URLSearchParams({ sourceId: String(sourceId) });
      if (path !== null) params.set("path", path);
      return apiGet<AssetSummary[]>(`/api/folders?${params.toString()}`);
    },
    enabled: sourceId !== null,
  });
}
