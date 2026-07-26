"use client";

import { useMemo } from "react";
import type { SourceWithMeta } from "@/lib/db/queries/sources";
import { useSources } from "@/lib/queries/sources";
import { useExplorerStore } from "@/lib/store";

export function useSelectedSource(): SourceWithMeta | null {
  const list = useSources().data ?? [];
  const selectedSourceId = useExplorerStore((s) => s.selectedSourceId);
  return useMemo(
    () => list.find((s) => s.id === selectedSourceId) ?? list[0] ?? null,
    [list, selectedSourceId],
  );
}
