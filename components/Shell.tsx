"use client";

import { useEffect, useMemo, useRef } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useFolder } from "@/lib/queries/folder";
import { type IndexerRun, useIndexerStatus } from "@/lib/queries/indexer-status";
import { useSources } from "@/lib/queries/sources";
import { useExplorerStore } from "@/lib/store";
import { ActionBar } from "./actions/ActionBar";
import { ClustersView } from "./clusters/ClustersView";
import { DetailDrawer } from "./detail/DetailDrawer";
import { EmptyState } from "./empty/EmptyState";
import { AssetGrid } from "./grid/AssetGrid";
import { BreadcrumbBar } from "./grid/BreadcrumbBar";
import { FolderEmptyState } from "./grid/FolderEmptyState";
import { IndexingCenter } from "./indexing/IndexingCenter";
import { MatchView } from "./match/MatchView";
import { PostIndexOverview } from "./overview/PostIndexOverview";
import { PlanDrawer } from "./plan/PlanDrawer";
import { ErrorState } from "./primitives/ErrorState";
import { ShortcutLayer } from "./ShortcutLayer";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";

export function Shell() {
  const sources = useSources();
  const selectedSourceId = useExplorerStore((s) => s.selectedSourceId);
  const selectedFolder = useExplorerStore((s) => s.selectedFolder);
  const setSelectedSource = useExplorerStore((s) => s.setSelectedSource);
  const setSelectedFolder = useExplorerStore((s) => s.setSelectedFolder);
  const view = useExplorerStore((s) => s.view);
  const setView = useExplorerStore((s) => s.setView);
  const search = useExplorerStore((s) => s.search);
  const extFilter = useExplorerStore((s) => s.extFilter);
  const sizeBucket = useExplorerStore((s) => s.sizeBucket);
  const unusedOnly = useExplorerStore((s) => s.unusedOnly);
  const gridSort = useExplorerStore((s) => s.gridSort);
  const debouncedSearch = useDebounce(search, 200);
  const indexerRun = useIndexerStatus();
  usePostIndexRouting(indexerRun, setView);

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
  const assetIds = useMemo(() => assets.map((a) => a.id), [assets]);

  if (sources.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg text-sm text-text-3">
        Loading…
      </div>
    );
  }

  if (sources.isError) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg p-8">
        <div className="w-full max-w-140">
          <ErrorState
            error={sources.error}
            title="Couldn't load sources"
            onRetry={() => sources.refetch()}
          />
        </div>
      </div>
    );
  }

  if (list.length === 0 || !selectedSource) {
    return (
      <div className="flex h-screen flex-col">
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
                className={view === "overview" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
                aria-hidden={view !== "overview"}
              >
                <PostIndexOverview
                  sourceId={selectedSource.id}
                  sourceLabel={selectedSource.label}
                  lastIndexedAt={selectedSource.lastIndexedAt ?? selectedSource.createdAt}
                />
              </div>
              <div
                className={view === "grid" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
                aria-hidden={view !== "grid"}
              >
                <BreadcrumbBar
                  sourceLabel={selectedSource.label}
                  folderPath={effectivePath}
                  assetCount={assets.length}
                  assetIds={assetIds}
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
                className={view === "clusters" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
                aria-hidden={view !== "clusters"}
              >
                <ClustersView
                  sourceId={selectedSource.id}
                  sourceLabel={selectedSource.label}
                  lastIndexedAt={selectedSource.lastIndexedAt}
                />
              </div>
              <div
                className={view === "match" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
                aria-hidden={view !== "match"}
              >
                <MatchView
                  sourceId={selectedSource.id}
                  sourceLabel={selectedSource.label}
                  lastIndexedAt={selectedSource.lastIndexedAt}
                />
              </div>
              <ActionBar sourceId={selectedSource.id} sourceLabel={selectedSource.label} />
              <DetailDrawer />
              <PlanDrawer sourceLabel={selectedSource.label} />
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

function usePostIndexRouting(
  run: IndexerRun | null,
  setView: (view: "overview", opts?: { manual?: boolean }) => void,
) {
  const prevRef = useRef<IndexerRun | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = run;

    const justStarted = run && !run.endedAt && (!prev || prev.endedAt);
    if (justStarted) {
      useExplorerStore.setState({ viewManuallySet: false });
      return;
    }

    const justEnded = run?.endedAt && prev && !prev.endedAt;
    if (justEnded) {
      if (!useExplorerStore.getState().viewManuallySet) {
        setView("overview", { manual: false });
      }
    }
  }, [run, setView]);
}
