"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Source } from "../db/schema";
import { apiGet, apiPost } from "./client";
import { qk } from "./keys";

export function useSources() {
  return useQuery({
    queryKey: qk.sources,
    queryFn: () => apiGet<Source[]>("/api/sources"),
  });
}

export function useAddSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { root: string; label?: string }) =>
      apiPost<Source, { root: string; label?: string }>("/api/sources", input),
    onSuccess: (source) => {
      qc.invalidateQueries({ queryKey: qk.sources });
      qc.invalidateQueries({ queryKey: qk.tree(source.id) });
    },
  });
}
