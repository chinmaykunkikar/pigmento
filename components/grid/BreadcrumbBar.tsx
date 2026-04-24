"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { useExplorerStore } from "@/lib/store";
import { formatBytes } from "@/lib/time";
import { Check, X } from "../icons";
import { SortMenu } from "./SortMenu";

type Props = {
  sourceLabel: string;
  folderPath: string | null;
  assetCount: number;
  assetIds: readonly number[];
  totalBytes: number;
  filtered?: boolean;
  onSelect: (path: string) => void;
};

export function BreadcrumbBar({
  sourceLabel,
  folderPath,
  assetCount,
  assetIds,
  totalBytes,
  filtered,
  onSelect,
}: Props) {
  const parts = folderPath ? folderPath.split("/").filter(Boolean) : [];
  const cartIds = useExplorerStore((s) => s.cartIds);
  const addToCart = useExplorerStore((s) => s.addToCart);
  const removeFromCart = useExplorerStore((s) => s.removeFromCart);
  const clearCart = useExplorerStore((s) => s.clearCart);

  const { allVisibleInCart, selectedInView } = useMemo(() => {
    if (assetIds.length === 0) return { allVisibleInCart: false, selectedInView: 0 };
    const cartSet = new Set(cartIds);
    let n = 0;
    for (const id of assetIds) if (cartSet.has(id)) n += 1;
    return { allVisibleInCart: n === assetIds.length, selectedInView: n };
  }, [assetIds, cartIds]);

  const canSelect = assetIds.length > 0;
  const hasCart = cartIds.length > 0;

  return (
    <div className="flex h-8 flex-shrink-0 items-center gap-2 border-b border-border bg-surface px-4">
      <span className="font-mono text-xs text-text-3">
        <button
          type="button"
          onClick={() => onSelect("")}
          className={cn(parts.length === 0 ? "text-text" : "hover:text-text")}
        >
          {sourceLabel}
        </button>
        {parts.map((p, i) => {
          const path = parts.slice(0, i + 1).join("/");
          const last = i === parts.length - 1;
          return (
            <span key={path}>
              <span className="text-text-4"> / </span>
              <button
                type="button"
                onClick={() => onSelect(path)}
                className={cn(last ? "text-text" : "hover:text-text")}
              >
                {p}
              </button>
            </span>
          );
        })}
      </span>

      <div className="flex-1" />

      <button
        type="button"
        disabled={!canSelect}
        onClick={() => (allVisibleInCart ? removeFromCart(assetIds) : addToCart(assetIds))}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-xs border px-1.5 font-mono text-2xs transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          allVisibleInCart
            ? "border-accent/30 bg-accent-bg text-accent-text hover:bg-accent-bg/80"
            : "border-border bg-surface text-text-2 hover:border-border-2 hover:bg-hover hover:text-text",
        )}
        title={
          allVisibleInCart
            ? "Deselect all assets in this view"
            : `Select all ${assetCount.toLocaleString()} assets in this view`
        }
      >
        <Check size={10} strokeWidth={1.75} />
        {allVisibleInCart
          ? `Deselect all (${selectedInView.toLocaleString()})`
          : `Select all${selectedInView > 0 ? ` · ${selectedInView.toLocaleString()} of ${assetCount.toLocaleString()}` : ""}`}
      </button>

      <button
        type="button"
        disabled={!hasCart}
        onClick={clearCart}
        className="inline-flex h-6 items-center gap-1 rounded-xs px-1.5 font-mono text-2xs text-text-3 transition-colors hover:bg-hover hover:text-text-2 disabled:cursor-not-allowed disabled:opacity-50"
        title="Clear full selection"
      >
        <X size={10} strokeWidth={1.75} />
        Clear{hasCart ? ` (${cartIds.length.toLocaleString()})` : ""}
      </button>

      <span className="h-3 w-px bg-border" />

      <span className="font-mono text-xs text-text-3 tabular-nums">
        {filtered ? (
          <span className="mr-1.5 rounded-xs bg-accent-bg px-1.5 py-px text-2xs font-semibold uppercase tracking-wider text-accent-text">
            filtered
          </span>
        ) : null}
        {assetCount.toLocaleString()} {filtered ? "matches" : "assets"} · {formatBytes(totalBytes)}
      </span>
      <span className="h-3 w-px bg-border" />
      <SortMenu />
    </div>
  );
}
