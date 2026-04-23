"use client";

import { useState } from "react";
import { useExactDuplicates, useNearDuplicates } from "@/lib/queries/duplicates";
import { useExplorerStore } from "@/lib/store";
import { FolderScopeChip } from "../primitives/FolderScopeChip";
import { ScrollArea } from "../primitives/ScrollArea";
import { DupTab } from "./DupTab";
import { ExactTab } from "./ExactTab";
import { NearTab } from "./NearTab";

type Mode = "exact" | "near";

type Props = { sourceId: number; sourceLabel: string };

export function DuplicatesView({ sourceId, sourceLabel }: Props) {
  const [mode, setMode] = useState<Mode>("exact");
  const selectedFolder = useExplorerStore((s) => s.selectedFolder);
  const folder = selectedFolder ?? undefined;
  const exact = useExactDuplicates(sourceId, folder);
  const near = useNearDuplicates(sourceId, folder);

  const exactCount = exact.data?.totalGroups ?? 0;
  const nearCount = near.data?.pairs.length ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      <div className="flex h-9 flex-shrink-0 items-center border-b border-border bg-surface pr-4">
        <DupTab
          label="Exact"
          count={exactCount}
          active={mode === "exact"}
          onClick={() => setMode("exact")}
        />
        <DupTab
          label="Near"
          count={nearCount}
          active={mode === "near"}
          onClick={() => setMode("near")}
        />
        <span className="ml-2">
          <FolderScopeChip />
        </span>
        <div className="flex-1" />
        {mode === "exact" ? (
          <span className="font-mono text-xs text-text-3">
            hash: <span className="text-text">sha1</span>
          </span>
        ) : (
          <span className="font-mono text-xs text-text-3">
            phash: <span className="text-text">dhash-64</span> · threshold:{" "}
            <span className="text-text">≤ 14</span>
          </span>
        )}
      </div>

      <ScrollArea className="flex-1">
        {mode === "exact" ? (
          <ExactTab sourceId={sourceId} sourceLabel={sourceLabel} />
        ) : (
          <NearTab sourceId={sourceId} sourceLabel={sourceLabel} />
        )}
      </ScrollArea>
    </div>
  );
}
