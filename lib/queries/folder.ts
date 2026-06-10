"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { AssetSummary } from "../db/queries/folders";
import type { GridSort } from "../store";
import { apiGet } from "./client";
import { qk } from "./keys";

export type FolderParams = {
  sourceId: number | null;
  path: string | null;
  q?: string;
  exts?: string[];
  unusedOnly?: boolean;
  sort?: GridSort;
};

function cacheKey(p: FolderParams): string {
  const parts = [
    p.sourceId ?? "null",
    p.path ?? "*",
    p.q ?? "",
    (p.exts ?? []).join("+"),
    p.unusedOnly ? "1" : "0",
    p.sort ?? "",
  ];
  return parts.join(":");
}

export function useFolder(p: FolderParams) {
  return useQuery({
    queryKey: p.sourceId !== null ? qk.folder(cacheKey(p)) : ["folder", "none"],
    queryFn: () => {
      const params = new URLSearchParams({ sourceId: String(p.sourceId) });
      if (p.path !== null) params.set("path", p.path);
      if (p.q) params.set("q", p.q);
      if (p.exts && p.exts.length > 0) params.set("exts", p.exts.join(","));
      if (p.unusedOnly) params.set("unusedOnly", "1");
      if (p.sort) params.set("sort", p.sort);
      return apiGet<AssetSummary[]>(`/api/folders?${params.toString()}`);
    },
    enabled: p.sourceId !== null,
    placeholderData: keepPreviousData,
  });
}
