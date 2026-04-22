"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { parsePixelSuffix, pixelSizeFromPath } from "@/lib/indexer/variants";
import { useAsset } from "@/lib/queries/asset";
import { useExplorerStore } from "@/lib/store";
import { TriangleAlert, X } from "../icons";
import { IconBtn } from "../primitives/IconBtn";
import { ActionsGrid } from "./ActionsGrid";
import { AssetPreview } from "./AssetPreview";
import { DuplicateGroupSection } from "./DuplicateGroupSection";
import { MetadataSection } from "./MetadataSection";
import { ReferencesList } from "./ReferencesList";
import { SizePips } from "./SizePips";

export function DetailDrawer() {
  const selectedAssetId = useExplorerStore((s) => s.selectedAssetId);
  const drawerOpen = useExplorerStore((s) => s.drawerOpen);
  const closeDrawer = useExplorerStore((s) => s.closeDrawer);
  const q = useAsset(drawerOpen ? selectedAssetId : null);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (asideRef.current?.contains(target)) return;
      if (target.closest?.("[data-asset-tile]")) return;
      closeDrawer();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [drawerOpen, closeDrawer]);

  useEffect(() => {
    if (q.isError) {
      useExplorerStore.setState({ selectedAssetId: null, drawerOpen: false });
    }
  }, [q.isError]);

  const inDupGroup =
    (q.data?.clusters.some((c) => c.kind === "hash") ?? false) ||
    (q.data?.nearDuplicates.length ?? 0) > 0 ||
    (q.data?.nameSiblings.length ?? 0) > 0;

  const currentSize = q.data
    ? (parsePixelSuffix(q.data.asset.stem)?.size ?? pixelSizeFromPath(q.data.asset.dir))
    : null;

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
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-text">
          {q.data?.asset.name ?? "—"}
        </span>
        {inDupGroup ? (
          <span
            title="Part of a duplicate cluster"
            className="inline-flex flex-shrink-0 items-center gap-1 rounded-xs bg-warn-bg px-1.5 py-px font-mono text-2xs font-semibold text-warn"
          >
            <TriangleAlert size={9} strokeWidth={2} />
            IN DUP GROUP
          </span>
        ) : null}
        <IconBtn label="Close" onClick={closeDrawer}>
          <X size={14} strokeWidth={1.5} />
        </IconBtn>
      </div>

      {q.isLoading ? (
        <div className="flex-1 p-4 text-xs text-text-3">Loading asset…</div>
      ) : q.isError ? (
        <div className="flex-1 p-4 text-xs text-danger">{(q.error as Error).message}</div>
      ) : q.data ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border p-3">
            <AssetPreview
              id={q.data.asset.id}
              name={q.data.asset.name}
              width={q.data.asset.width}
              height={q.data.asset.height}
            />
            <SizePips currentSize={currentSize} variants={q.data.sizeVariants} />
          </div>
          <MetadataSection asset={q.data.asset} />
          <ActionsGrid asset={q.data.asset} />
          <DuplicateGroupSection
            clusters={q.data.clusters}
            nearDuplicates={q.data.nearDuplicates}
            nameSiblings={q.data.nameSiblings}
            currentAssetId={q.data.asset.id}
          />
          <ReferencesList assetId={q.data.asset.id} totalCount={q.data.usageCount} />
        </div>
      ) : null}
    </aside>
  );
}
