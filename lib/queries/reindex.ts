"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Source } from "../db/schema";
import { apiPost } from "./client";
import { qk } from "./keys";

export function useReindex(sourceId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { full?: boolean } = {}) => {
      if (sourceId === null) throw new Error("no source selected");
      return apiPost<Source, { full?: boolean }>(`/api/sources/${sourceId}/reindex`, opts);
    },
    onSuccess: () => {
      if (sourceId === null) return;
      qc.invalidateQueries({ queryKey: qk.sources });
      qc.invalidateQueries({ queryKey: qk.tree(sourceId) });
      qc.invalidateQueries({ queryKey: ["folder"] });
    },
  });
}
