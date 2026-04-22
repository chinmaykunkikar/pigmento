"use client";

import { useQuery } from "@tanstack/react-query";
import type { TreeNode } from "../db/queries/folders";
import { apiGet } from "./client";
import { qk } from "./keys";

export function useTree(sourceId: number | null) {
  return useQuery({
    queryKey: sourceId !== null ? qk.tree(sourceId) : ["tree", "none"],
    queryFn: () => apiGet<TreeNode>(`/api/tree?sourceId=${sourceId}`),
    enabled: sourceId !== null,
  });
}
