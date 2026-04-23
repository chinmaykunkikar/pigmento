"use client";

import { useEffect, useMemo } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useFolder } from "@/lib/queries/folder";
import { useIndexerStatus } from "@/lib/queries/indexer-status";
import { useSources } from "@/lib/queries/sources";
import { useExplorerStore } from "@/lib/store";
import { DetailDrawer } from "./detail/DetailDrawer";
import { DuplicatesView } from "./duplicates/DuplicatesView";
import { EmptyState } from "./empty/EmptyState";
import { AssetGrid } from "./grid/AssetGrid";
import { BreadcrumbBar } from "./grid/BreadcrumbBar";
import { FolderEmptyState } from "./grid/FolderEmptyState";
import { GroupedView } from "./grouped/GroupedView";
import { IndexingCenter } from "./indexing/IndexingCenter";
import { CleanupPlan } from "./plan/CleanupPlan";
import { ShortcutLayer } from "./ShortcutLayer";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";
import { WindowChrome } from "./WindowChrome";

export function Shell() {
  const sources = useSources();
  const selectedSourceId = useExplorerStore((s) => s.selectedSourceId);
  const selectedFolder = useExplorerStore((s) => s.selectedFolder);
  const setSelectedSource = useExplorerStore((s) => s.setSelectedSource);
  const setSelectedFolder = useExplorerStore((s) => s.setSelectedFolder);
  const view = useExplorerStore((s) => s.view);
  const search = useExplorerStore((s) => s.search);
  const extFilter = useExplorerStore((s) => s.extFilter);
  const sizeBucket = useExplorerStore((s) => s.sizeBucket);
  const unusedOnly = useExplorerStore((s) => s.unusedOnly);
  const gridSort = useExplorerStore((s) => s.gridSort);
  const debouncedSearch = useDebounce(search, 200);
  const indexerRun = useIndexerStatus();

  const list = sources.data ?? [];
  const selectedSource = useMemo(
    () => list.find((s) => s.id === selectedSourceId) ?? list[0] ?? null,
    [list, selectedSourceId],
  );

  useEffect(() => {
    if (list.length === 0) return;
    if (!selectedSource) return;
    if (selectedSource.id !== selectedSourceId) setSelectedSource(selectedSource.id);
  }, [list.length, selectedSource, selectedSourceId, setSelectedSource]);

  const effectivePath = selectedFolder ?? "";
  const folder = useFolder({
    sourceId: selectedSource?.id ?? null,
    path: effectivePath,
    q: debouncedSearch,
    exts: extFilter,
    size: sizeBucket,
    unusedOnly,
    sort: gridSort,
  });
  const assets = folder.data ?? [];

  const totalBytes = useMemo(() => assets.reduce((n, a) => n + a.size, 0), [assets]);

  if (sources.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg text-sm text-text-3">
        Loading…
      </div>
    );
  }

  if (list.length === 0 || !selectedSource) {
    return (
      <div className="flex h-screen flex-col">
        <WindowChrome title="PixelDex" />
        {indexerRun ? (
          <IndexingCenter run={indexerRun} />
        ) : (
          <EmptyState onAdded={(id) => setSelectedSource(id)} />
        )}
        <ShortcutLayer source={null} />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <WindowChrome title={`PixelDex — ${selectedSource.label}`} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          sources={list}
          selectedSourceId={selectedSource.id}
          selectedFolder={effectivePath}
          onSelectSource={(id) => {
            setSelectedSource(id);
            setSelectedFolder("");
          }}
          onSelectFolder={(p) => setSelectedFolder(p)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Toolbar
            source={selectedSource}
            indexerProgress={
              indexerRun && indexerRun.sourceId === selectedSource.id ? indexerRun.progress : null
            }
          />
          {indexerRun && indexerRun.sourceId === selectedSource.id ? (
            <IndexingCenter run={indexerRun} />
          ) : (
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <div
                className={view === "grid" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
                aria-hidden={view !== "grid"}
              >
                <BreadcrumbBar
                  sourceLabel={selectedSource.label}
                  folderPath={effectivePath}
                  assetCount={assets.length}
                  totalBytes={totalBytes}
                  filtered={
                    debouncedSearch.length > 0 ||
                    extFilter.length > 0 ||
                    sizeBucket !== null ||
                    unusedOnly
                  }
                  onSelect={(p) => setSelectedFolder(p)}
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  {folder.isLoading ? (
                    <div className="flex flex-1 items-center justify-center bg-bg text-sm text-text-3">
                      Loading folder…
                    </div>
                  ) : assets.length === 0 ? (
                    <FolderEmptyState
                      sourceId={selectedSource.id}
                      folderPath={effectivePath}
                      filterActive={
                        debouncedSearch.length > 0 ||
                        extFilter.length > 0 ||
                        sizeBucket !== null ||
                        unusedOnly
                      }
                    />
                  ) : (
                    <AssetGrid assets={assets} />
                  )}
                </div>
              </div>
              <div
                className={view === "grouped" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
                aria-hidden={view !== "grouped"}
              >
                <GroupedView sourceId={selectedSource.id} sourceLabel={selectedSource.label} />
              </div>
              <div
                className={view === "duplicates" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
                aria-hidden={view !== "duplicates"}
              >
                <DuplicatesView sourceId={selectedSource.id} sourceLabel={selectedSource.label} />
              </div>
              {view === "plan" ? <CleanupPlan sourceLabel={selectedSource.label} /> : null}
              <DetailDrawer />
            </div>
          )}
        </div>
      </div>
      <StatusBar
        totalAssets={assets.length}
        totalBytes={totalBytes}
        folderPath={effectivePath || "/"}
      />
      <ShortcutLayer source={selectedSource} />
    </div>
  );
}
