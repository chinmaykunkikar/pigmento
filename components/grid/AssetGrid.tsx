"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { type MouseEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AssetSummary } from "@/lib/db/queries/folders";
import { useExplorerStore } from "@/lib/store";
import { ScrollArea } from "../primitives/ScrollArea";
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
  const cartIds = useExplorerStore((s) => s.cartIds);
  const toggleCartItem = useExplorerStore((s) => s.toggleCartItem);
  const setCartRange = useExplorerStore((s) => s.setCartRange);

  const cartSet = useMemo(() => new Set(cartIds), [cartIds]);
  const orderedIds = useMemo(() => assets.map((a) => a.id), [assets]);

  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const c = Math.max(1, Math.floor((w + GAP) / (TILE_MIN_WIDTH + GAP)));
      setCols((prev) => (prev === c ? prev : c));
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
    return null;
  }

  const cartActive = cartIds.length > 0;

  const handleTileClick = (id: number) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleCartItem(id);
      return;
    }
    if (e.shiftKey && cartIds.length > 0) {
      e.preventDefault();
      setCartRange(id, orderedIds);
      return;
    }
    if (cartActive) {
      toggleCartItem(id);
      return;
    }
    openAsset(id);
  };

  const handleToggle = (id: number) => () => toggleCartItem(id);

  return (
    <ScrollArea ref={parentRef} className="flex-1 bg-bg">
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
                  inCart={cartSet.has(a.id)}
                  cartActive={cartActive}
                  onClick={handleTileClick(a.id)}
                  onToggleCart={handleToggle(a.id)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
