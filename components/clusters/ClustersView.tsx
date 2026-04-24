"use client";

import { useState } from "react";
import type { GroupSort } from "@/lib/db/queries/groups";
import { useExactDuplicates, useNearDuplicates } from "@/lib/queries/duplicates";
import { useGroups } from "@/lib/queries/groups";
import { useReindex } from "@/lib/queries/reindex";
import { useExplorerStore } from "@/lib/store";
import { DupTab } from "../duplicates/DupTab";
import { ExactTab } from "../duplicates/ExactTab";
import { NearTab } from "../duplicates/NearTab";
import { ClusterRow } from "../grouped/ClusterRow";
import { Layers, RefreshCw } from "../icons";
import { Button } from "../primitives/Button";
import { ErrorState } from "../primitives/ErrorState";
import { FolderScopeChip } from "../primitives/FolderScopeChip";
import { ScrollArea } from "../primitives/ScrollArea";

type Mode = "exact" | "near" | "name";

type Props = { sourceId: number; sourceLabel: string; lastIndexedAt: string | null };

export function ClustersView({ sourceId, sourceLabel, lastIndexedAt }: Props) {
  const [mode, setMode] = useState<Mode>("exact");
  const [nameSort, setNameSort] = useState<GroupSort>("size");
  const selectedFolder = useExplorerStore((s) => s.selectedFolder);
  const folder = selectedFolder ?? undefined;
  const reindex = useReindex(sourceId);

  const exact = useExactDuplicates(sourceId, folder);
  const near = useNearDuplicates(sourceId, folder);
  const name = useGroups(sourceId, nameSort, folder);

  const exactCount = exact.data?.totalGroups ?? 0;
  const nearCount = near.data?.pairs.length ?? 0;
  const nameCount = name.data?.total ?? 0;

  if (!lastIndexedAt) {
    return <FirstVisitHint onReindex={() => reindex.mutate({})} pending={reindex.isPending} />;
  }

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
        <DupTab
          label="Name"
          count={nameCount}
          active={mode === "name"}
          onClick={() => setMode("name")}
        />
        <span className="ml-2">
          <FolderScopeChip />
        </span>
        <div className="flex-1" />
        <ModeMeta mode={mode} sort={nameSort} onSortChange={setNameSort} />
      </div>

      {mode === "exact" ? (
        <ScrollArea className="flex-1">
          <ExactTab sourceId={sourceId} sourceLabel={sourceLabel} />
        </ScrollArea>
      ) : null}
      {mode === "near" ? (
        <ScrollArea className="flex-1">
          <NearTab sourceId={sourceId} sourceLabel={sourceLabel} />
        </ScrollArea>
      ) : null}
      {mode === "name" ? (
        <ScrollArea className="flex-1 bg-bg">
          <NameTab query={name} sourceId={sourceId} sourceLabel={sourceLabel} />
        </ScrollArea>
      ) : null}
    </div>
  );
}

function ModeMeta({
  mode,
  sort,
  onSortChange,
}: {
  mode: Mode;
  sort: GroupSort;
  onSortChange: (s: GroupSort) => void;
}) {
  if (mode === "exact") {
    return (
      <span className="font-mono text-xs text-text-3">
        hash: <span className="text-text">sha1</span>
      </span>
    );
  }
  if (mode === "near") {
    return (
      <span className="font-mono text-xs text-text-3">
        phash: <span className="text-text">dhash-64</span> · threshold:{" "}
        <span className="text-text">≤ 14</span>
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1 font-mono text-xs text-text-3">
      <span>Sort:</span>
      <button
        type="button"
        onClick={() => onSortChange("size")}
        className={sort === "size" ? "text-text" : "hover:text-text"}
      >
        Size
      </button>
      <span className="text-text-4">·</span>
      <button
        type="button"
        onClick={() => onSortChange("alpha")}
        className={sort === "alpha" ? "text-text" : "hover:text-text"}
      >
        A–Z
      </button>
    </div>
  );
}

type NameQuery = ReturnType<typeof useGroups>;

function NameTab({
  query,
  sourceId,
  sourceLabel,
}: {
  query: NameQuery;
  sourceId: number;
  sourceLabel: string;
}) {
  if (query.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-3">
        Loading clusters…
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="m-4">
        <ErrorState
          error={query.error}
          title="Couldn't load name clusters"
          onRetry={() => query.refetch()}
        />
      </div>
    );
  }
  const page = query.data;
  if (!page || page.groups.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-sm text-text-3">
        <span>No name clusters found</span>
        <span className="text-xs text-text-4">
          Clusters form when two or more assets share a canonical stem
        </span>
      </div>
    );
  }
  return (
    <div>
      {page.groups.map((g) => (
        <ClusterRow key={g.id} group={g} sourceId={sourceId} sourceLabel={sourceLabel} />
      ))}
    </div>
  );
}

function FirstVisitHint({ onReindex, pending }: { onReindex: () => void; pending: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-bg p-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-sunken">
        <Layers size={14} strokeWidth={1.5} className="text-text-3" />
      </span>
      <div className="max-w-110">
        <div className="mb-1 font-sans text-md font-medium text-text">No clusters yet</div>
        <div className="font-sans text-sm leading-relaxed text-text-2">
          Clusters group visually similar assets by hash, perceptual hash, and shared canonical
          names. Run an index to populate them.
        </div>
      </div>
      <Button variant="primary" className="h-8 px-3.5" disabled={pending} onClick={onReindex}>
        <RefreshCw size={12} strokeWidth={1.5} className={pending ? "animate-spin" : undefined} />
        {pending ? "Indexing…" : "Run index"}
      </Button>
    </div>
  );
}
