"use client";

import { useQuery } from "@tanstack/react-query";
import type { OverviewCounts } from "../db/queries/overview";
import { apiGet } from "./client";
import { qk } from "./keys";

export function useOverviewCounts(sourceId: number | null) {
  return useQuery({
    queryKey: sourceId !== null ? qk.overview(sourceId) : ["overview", "none"],
    queryFn: () => apiGet<OverviewCounts>(`/api/overview?sourceId=${sourceId}`),
    enabled: sourceId !== null,
  });
}
