"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UsageRow } from "@/lib/db/queries/asset-detail";
import type { Conflict, Tip, Warning } from "@/lib/rename/validate";
import { apiGet, apiPost } from "./client";
import { qk } from "./keys";

export type PreflightPayload = {
  ok: boolean;
  conflicts: Conflict[];
  warnings: Warning[];
  tips: Tip[];
  affectedUsages: UsageRow[];
  newName: string;
  newRelPath: string;
  newAbsPath: string;
  canRenameNow: boolean;
};

export type RenameInput = {
  assetId: number;
  newName: string;
  acceptedUsageIds?: number[] | "all";
  skipStale?: boolean;
};

export type RenameResult = {
  assetId: number;
  newRelPath: string;
  newName: string;
  updatedUsageCount: number;
  commitSha: string | null;
  staleRefs: { usageId: number; relPath: string; line: number }[];
  reindexWarning?: string;
};

export function useRenamePreflight(assetId: number | null, target: string, enabled: boolean) {
  const trimmed = target.trim();
  return useQuery({
    enabled: enabled && assetId !== null && trimmed.length > 0,
    queryKey:
      assetId === null
        ? (["asset", 0, "rename", "preflight", ""] as const)
        : qk.renamePreflight(assetId, trimmed),
    queryFn: () =>
      apiGet<PreflightPayload>(
        `/api/assets/${assetId}/rename/preflight?target=${encodeURIComponent(trimmed)}`,
      ),
    staleTime: 1000,
    placeholderData: keepPreviousData,
  });
}

export function useRenameAsset(sourceId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, newName, acceptedUsageIds = "all", skipStale = false }: RenameInput) =>
      apiPost<RenameResult, Omit<RenameInput, "assetId">>(`/api/assets/${assetId}/rename`, {
        newName,
        acceptedUsageIds,
        skipStale,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.asset(data.assetId) });
      qc.invalidateQueries({ queryKey: qk.usages(data.assetId) });
      if (sourceId !== null) {
        qc.invalidateQueries({ queryKey: qk.tree(sourceId) });
        qc.invalidateQueries({ queryKey: qk.overview(sourceId) });
      }
      qc.invalidateQueries({ queryKey: ["folder"] });
      qc.invalidateQueries({ queryKey: ["duplicates"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}
