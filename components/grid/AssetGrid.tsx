"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import type { AssetSummary } from "@/lib/db/queries/folders";
import { useExplorerStore } from "@/lib/store";
import { AssetTile } from "./AssetTile";

type Props = { assets: AssetSummary[] };

const TILE_MIN_WIDTH = 140;
const ROW_HEIGHT = 172;
const GAP = 1;

export function AssetGrid({ assets }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(8);
  const boundingBoxes = useExplorerStore((s) => s.boundingBoxes);
  const selectedAssetId = useExplorerStore((s) => s.selectedAssetId);
  const openAsset = useExplorerStore((s) => s.openAsset);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const c = Math.max(1, Math.floor((w + GAP) / (TILE_MIN_WIDTH + GAP)));
      setCols(c);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rowCount = Math.ceil(assets.length / cols);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT + GAP,
    overscan: 4,
  });

  if (assets.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg text-sm text-text-3">
        No assets in this folder
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-auto bg-bg">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((vr) => {
          const start = vr.index * cols;
          const rowAssets = assets.slice(start, start + cols);
          return (
            <div
              key={vr.key}
              className="absolute left-0 top-0 grid w-full"
              style={{
                transform: `translateY(${vr.start}px)`,
                height: ROW_HEIGHT,
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gap: GAP,
              }}
            >
              {rowAssets.map((a) => (
                <AssetTile
                  key={a.id}
                  asset={a}
                  showBoundingBox={boundingBoxes}
                  selected={a.id === selectedAssetId}
                  onClick={() => openAsset(a.id)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
