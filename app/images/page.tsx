"use client";

import { useMemo } from "react";
import { PikaMark } from "@/components/brand/PikaMark";
import { ClustersView } from "@/components/clusters/ClustersView";
import { AssetGrid } from "@/components/grid/AssetGrid";
import { BreadcrumbBar } from "@/components/grid/BreadcrumbBar";
import { FolderEmptyState } from "@/components/grid/FolderEmptyState";
import { Layers, LayoutGrid, ScanSearch } from "@/components/icons";
import { MatchView } from "@/components/match/MatchView";
import { ErrorState } from "@/components/primitives/ErrorState";
import { Segmented } from "@/components/primitives/Segmented";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useSelectedSource } from "@/lib/hooks/useSelectedSource";
import { useFolder } from "@/lib/queries/folder";
import { type ImagesView, useExplorerStore } from "@/lib/store";

export default function ImagesPage() {
  const source = useSelectedSource();
  const imagesView = useExplorerStore((s) => s.imagesView);
  const setImagesView = useExplorerStore((s) => s.setImagesView);
  const selectedFolder = useExplorerStore((s) => s.selectedFolder);
  const search = useExplorerStore((s) => s.search);
  const extFilter = useExplorerStore((s) => s.extFilter);
  const unusedOnly = useExplorerStore((s) => s.unusedOnly);
  const gridSort = useExplorerStore((s) => s.gridSort);
  const debouncedSearch = useDebounce(search, 200);

  const effectivePath = selectedFolder ?? "";
  const folder = useFolder({
    sourceId: source?.id ?? null,
    path: effectivePath,
    q: debouncedSearch,
    exts: extFilter,
    unusedOnly,
    sort: gridSort,
  });
  const assets = folder.data ?? [];
  const totalBytes = useMemo(() => assets.reduce((n, a) => n + a.size, 0), [assets]);
  const assetIds = useMemo(() => assets.map((a) => a.id), [assets]);

  if (!source) return null;

  const filtered = debouncedSearch.length > 0 || extFilter.length > 0 || unusedOnly;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b border-border bg-surface px-4">
        <Segmented<ImagesView>
          value={imagesView}
          onChange={setImagesView}
          items={[
            { value: "grid", icon: <LayoutGrid size={12} strokeWidth={1.5} />, label: "Grid" },
            { value: "clusters", icon: <Layers size={12} strokeWidth={1.5} />, label: "Clusters" },
            { value: "match", icon: <ScanSearch size={12} strokeWidth={1.5} />, label: "Match" },
          ]}
        />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className={imagesView === "grid" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
          aria-hidden={imagesView !== "grid"}
        >
          <BreadcrumbBar
            sourceLabel={source.label}
            folderPath={effectivePath}
            assetCount={assets.length}
            assetIds={assetIds}
            totalBytes={totalBytes}
            filtered={filtered}
            onSelect={(p) => useExplorerStore.getState().setSelectedFolder(p)}
          />
          <div className="flex min-h-0 flex-1 flex-col">
            {folder.isLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-bg">
                <PikaMark size={20} blink />
                <span className="font-mono text-xs text-text-3">loading folder…</span>
              </div>
            ) : folder.isError ? (
              <div className="m-4">
                <ErrorState
                  error={folder.error}
                  title="Couldn't load folder"
                  onRetry={() => folder.refetch()}
                />
              </div>
            ) : assets.length === 0 ? (
              <FolderEmptyState
                sourceId={source.id}
                folderPath={effectivePath}
                filterActive={filtered}
              />
            ) : (
              <AssetGrid assets={assets} />
            )}
          </div>
        </div>

        <div
          className={imagesView === "clusters" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
          aria-hidden={imagesView !== "clusters"}
        >
          <ClustersView
            sourceId={source.id}
            sourceLabel={source.label}
            lastIndexedAt={source.lastIndexedAt}
          />
        </div>

        <div
          className={imagesView === "match" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
          aria-hidden={imagesView !== "match"}
        >
          <MatchView
            sourceId={source.id}
            sourceLabel={source.label}
            lastIndexedAt={source.lastIndexedAt}
          />
        </div>
      </div>
    </div>
  );
}
