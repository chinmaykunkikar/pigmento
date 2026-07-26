"use client";

import { useQuery } from "@tanstack/react-query";
import type { DesignIdentity } from "../db/queries/identity";
import { apiGet } from "./client";
import { qk } from "./keys";

export function useDesignIdentity(sourceId: number | null) {
  return useQuery({
    queryKey: sourceId !== null ? qk.identity(sourceId) : ["identity", "none"],
    queryFn: () => apiGet<DesignIdentity>(`/api/identity?sourceId=${sourceId}`),
    enabled: sourceId !== null,
  });
}
