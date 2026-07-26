"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { useSelectedSource } from "@/lib/hooks/useSelectedSource";
import { type IndexerRun, useIndexerStatus } from "@/lib/queries/indexer-status";
import { useSources } from "@/lib/queries/sources";
import { useExplorerStore } from "@/lib/store";
import { ActionBar } from "./actions/ActionBar";
import { PikaMark } from "./brand/PikaMark";
import { DetailDrawer } from "./detail/DetailDrawer";
import { EmptyState } from "./empty/EmptyState";
import { IndexingCenter } from "./indexing/IndexingCenter";
import { IndexingStrip } from "./indexing/IndexingStrip";
import { NarrowViewportBanner } from "./NarrowViewportBanner";
import { PlanDrawer } from "./plan/PlanDrawer";
import { ErrorState } from "./primitives/ErrorState";
import { ShortcutLayer } from "./ShortcutLayer";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const sources = useSources();
  const selectedSourceId = useExplorerStore((s) => s.selectedSourceId);
  const selectedFolder = useExplorerStore((s) => s.selectedFolder);
  const setSelectedSource = useExplorerStore((s) => s.setSelectedSource);
  const setSelectedFolder = useExplorerStore((s) => s.setSelectedFolder);
  const indexerRun = useIndexerStatus();
  usePostIndexRouting(indexerRun);

  const list = sources.data ?? [];
  const selectedSource = useSelectedSource();

  useEffect(() => {
    if (list.length === 0) return;
    if (!selectedSource) return;
    if (selectedSource.id !== selectedSourceId) setSelectedSource(selectedSource.id);
  }, [list.length, selectedSource, selectedSourceId, setSelectedSource]);

  const effectivePath = selectedFolder ?? "";

  if (sources.isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg">
        <PikaMark size={32} blink />
        <span className="font-mono text-xs text-text-3">loading…</span>
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

  // The home route owns its own first-run: the ghosted overview + add-source
  // entries render inside the chrome and morph in place on index (A7). Every other
  // route needs a source before it means anything, so it still takes over.
  if ((list.length === 0 || !selectedSource) && !onHome) {
    return (
      <div className="flex h-screen flex-col">
        <NarrowViewportBanner />
        {indexerRun ? (
          <IndexingCenter run={indexerRun} />
        ) : (
          <EmptyState onAdded={(id) => setSelectedSource(id)} />
        )}
        <ShortcutLayer source={null} />
      </div>
    );
  }

  const firstIndexTakeover =
    !onHome &&
    indexerRun &&
    selectedSource &&
    indexerRun.sourceId === selectedSource.id &&
    !selectedSource.lastIndexedAt;

  return (
    <div className="flex h-screen flex-col">
      <NarrowViewportBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          sources={list}
          selectedSourceId={selectedSource?.id ?? null}
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
              indexerRun && selectedSource && indexerRun.sourceId === selectedSource.id
                ? indexerRun.progress
                : null
            }
          />
          {firstIndexTakeover ? (
            <IndexingCenter run={indexerRun} />
          ) : (
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
              {selectedSource ? (
                <>
                  <ActionBar sourceId={selectedSource.id} sourceLabel={selectedSource.label} />
                  <DetailDrawer />
                  <PlanDrawer sourceLabel={selectedSource.label} />
                </>
              ) : null}
              {indexerRun && selectedSource && indexerRun.sourceId === selectedSource.id ? (
                <IndexingStrip run={indexerRun} />
              ) : null}
            </div>
          )}
        </div>
      </div>
      <ShortcutLayer source={selectedSource} />
    </div>
  );
}

function usePostIndexRouting(run: IndexerRun | null) {
  const router = useRouter();
  const prevRef = useRef<IndexerRun | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = run;

    const justStarted = run && !run.endedAt && (!prev || prev.endedAt);
    if (justStarted) {
      useExplorerStore.setState({ navManuallySet: false });
      return;
    }

    const justEnded = run?.endedAt && prev && !prev.endedAt;
    if (justEnded) {
      useExplorerStore.setState({ signaturePending: true });
      if (!useExplorerStore.getState().navManuallySet) {
        router.push("/");
      }
    }
  }, [run, router]);
}
