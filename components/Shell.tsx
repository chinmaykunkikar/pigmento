"use client";

import { useEffect, useMemo } from "react";
import { useFolder } from "../lib/queries/folder";
import { useSources } from "../lib/queries/sources";
import { useExplorerStore } from "../lib/store";
import { EmptyState } from "./empty/EmptyState";
import { AssetGrid } from "./grid/AssetGrid";
import { BreadcrumbBar } from "./grid/BreadcrumbBar";
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
  const folder = useFolder(selectedSource?.id ?? null, effectivePath);
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
        <EmptyState onAdded={(id) => setSelectedSource(id)} />
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
          <Toolbar source={selectedSource} />
          <BreadcrumbBar
            sourceLabel={selectedSource.label}
            folderPath={effectivePath}
            assetCount={assets.length}
            totalBytes={totalBytes}
            onSelect={(p) => setSelectedFolder(p)}
          />
          {folder.isLoading ? (
            <div className="flex flex-1 items-center justify-center bg-bg text-sm text-text-3">
              Loading folder…
            </div>
          ) : (
            <AssetGrid assets={assets} />
          )}
        </div>
      </div>
      <StatusBar
        totalAssets={assets.length}
        totalBytes={totalBytes}
        folderPath={effectivePath || "/"}
      />
    </div>
  );
}
