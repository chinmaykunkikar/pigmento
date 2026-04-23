"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { parsePixelSuffix, pixelSizeFromPath } from "@/lib/indexer/variants";
import { useAsset } from "@/lib/queries/asset";
import { useExplorerStore } from "@/lib/store";
import { ArrowLeft, Pencil, X } from "../icons";
import { IconBtn } from "../primitives/IconBtn";
import { ScrollArea } from "../primitives/ScrollArea";
import { ActionsGrid } from "./ActionsGrid";
import { AssetPreview } from "./AssetPreview";
import { DuplicateGroupSection } from "./DuplicateGroupSection";
import { MetadataSection } from "./MetadataSection";
import { ReferencesList } from "./ReferencesList";
import { RenameDialog } from "./RenameDialog";
import { SizePips } from "./SizePips";

export function DetailDrawer() {
  const selectedAssetId = useExplorerStore((s) => s.selectedAssetId);
  const drawerOpen = useExplorerStore((s) => s.drawerOpen);
  const closeDrawer = useExplorerStore((s) => s.closeDrawer);
  const assetHistory = useExplorerStore((s) => s.assetHistory);
  const goBackAsset = useExplorerStore((s) => s.goBackAsset);
  const q = useAsset(drawerOpen ? selectedAssetId : null);
  const asideRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (asideRef.current?.contains(target)) return;
      if (target.closest?.("[data-asset-tile]")) return;
      if (target.closest?.("[data-radix-popper-content-wrapper]")) return;
      closeDrawer();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [drawerOpen, closeDrawer]);

  useEffect(() => {
    if (q.isError) {
      useExplorerStore.setState({
        selectedAssetId: null,
        drawerOpen: false,
        assetHistory: [],
      });
    }
  }, [q.isError]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const currentSize = q.data
    ? (parsePixelSuffix(q.data.asset.stem)?.size ?? pixelSizeFromPath(q.data.asset.dir))
    : null;

  const prevEntry = assetHistory[assetHistory.length - 1] ?? null;

  return (
    <aside
      ref={asideRef}
      aria-hidden={!drawerOpen}
      className={cn(
        "absolute inset-y-0 right-0 z-20 flex w-100 flex-col overflow-hidden border-l border-border bg-surface transition-transform duration-300 ease-out",
        drawerOpen ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
      style={{ boxShadow: "var(--shadow-drawer)" }}
    >
      <div className="flex h-11 flex-shrink-0 items-center gap-2 border-b border-border px-3">
        {prevEntry ? (
          <button
            type="button"
            onClick={goBackAsset}
            title={`Back to ${prevEntry.name}`}
            className="inline-flex h-6 min-w-0 shrink-0 max-w-35 items-center gap-1 rounded-xs border border-border bg-surface px-1.5 font-mono text-2xs text-text-2 transition-colors hover:bg-hover hover:text-text"
          >
            <ArrowLeft size={11} strokeWidth={1.75} className="flex-shrink-0" />
            <span className="truncate">{prevEntry.name}</span>
          </button>
        ) : null}
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="min-w-0 truncate font-mono text-xs font-medium text-text">
            {q.data?.asset.name ?? "-"}
          </span>
          {q.data ? (
            <IconBtn label="Rename" onClick={() => setRenameOpen(true)}>
              <Pencil size={12} strokeWidth={1.5} />
            </IconBtn>
          ) : null}
        </div>
        <IconBtn label="Close" onClick={closeDrawer}>
          <X size={14} strokeWidth={1.5} />
        </IconBtn>
      </div>

      {q.isLoading ? (
        <div className="flex-1 p-4 text-xs text-text-3">Loading asset…</div>
      ) : q.isError ? (
        <div className="flex-1 p-4 text-xs text-danger">{(q.error as Error).message}</div>
      ) : q.data ? (
        <ScrollArea ref={scrollRef} className="min-h-0 flex-1">
          <div className="sticky top-0 z-10 border-b border-border bg-surface p-3">
            <AssetPreview
              id={q.data.asset.id}
              name={q.data.asset.name}
              width={q.data.asset.width}
              height={q.data.asset.height}
            />
            <SizePips currentSize={currentSize} variants={q.data.sizeVariants} />
          </div>
          <MetadataSection asset={q.data.asset} />
          <ActionsGrid asset={q.data.asset} onRename={() => setRenameOpen(true)} />
          <DuplicateGroupSection
            clusters={q.data.clusters}
            nearDuplicates={q.data.nearDuplicates}
            nameSiblings={q.data.nameSiblings}
            currentAssetId={q.data.asset.id}
            currentAssetName={q.data.asset.name}
          />
          <ReferencesList assetId={q.data.asset.id} totalCount={q.data.usageCount} />
        </ScrollArea>
      ) : null}
      {q.data ? (
        <RenameDialog asset={q.data.asset} open={renameOpen} onOpenChange={setRenameOpen} />
      ) : null}
    </aside>
  );
}
