"use client";

import type { MouseEvent } from "react";
import { cn } from "@/lib/cn";
import type { AssetSummary } from "@/lib/db/queries/folders";
import { truncateMid } from "@/lib/text";
import { formatBytes } from "@/lib/time";
import { Check } from "../icons";
import { SelectCheckbox } from "../primitives/SelectCheckbox";

const SELECTED_SHADOW = "var(--shadow-tile-selected)";

type Props = {
  asset: AssetSummary;
  selected?: boolean;
  showBoundingBox?: boolean;
  inCart: boolean;
  cartActive: boolean;
  ariaColIndex?: number;
  onClick: (e: MouseEvent) => void;
  onToggleCart: () => void;
};

export function AssetTile({
  asset,
  selected,
  showBoundingBox,
  inCart,
  cartActive,
  ariaColIndex,
  onClick,
  onToggleCart,
}: Props) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: button-as-gridcell keeps click semantics; virtualized grid can't use <td>
    <button
      type="button"
      role="gridcell"
      aria-selected={selected ?? false}
      aria-colindex={ariaColIndex}
      data-asset-tile="true"
      onClick={onClick}
      style={selected ? { boxShadow: SELECTED_SHADOW } : undefined}
      className={cn(
        "group/tile relative flex flex-col overflow-hidden rounded-xs border border-border bg-surface text-left transition-[box-shadow,border-color] duration-150 ease-out will-change-transform",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent/60",
        cartActive ? "cursor-pointer" : "cursor-pointer hover:border-border-2 active:scale-[0.97]",
        selected && "z-10 border-transparent",
        inCart && "border-accent/40",
      )}
    >
      <div className="bg-checker relative flex min-h-25 flex-1 items-center justify-center">
        <div
          className={cn(
            "absolute left-1.5 top-1.5 z-10 transition-opacity duration-150",
            inCart
              ? "opacity-100"
              : "opacity-0 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100",
          )}
        >
          <SelectCheckbox checked={inCart} onToggle={onToggleCart} label={asset.name} />
        </div>
        {selected ? (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-xs bg-accent text-on-accent"
          >
            <Check size={10} strokeWidth={1.75} />
          </span>
        ) : null}
        {/** biome-ignore lint/performance/noImgElement: local preview stream, Next Image requires config */}
        <img
          src={`/api/preview/${asset.id}`}
          alt={asset.name}
          loading="lazy"
          draggable={false}
          className="max-h-[80%] max-w-[80%] select-none"
          style={
            showBoundingBox
              ? { outline: "1px dashed var(--color-border-2)", outlineOffset: -1 }
              : undefined
          }
        />
      </div>
      <div
        className={cn(
          "border-t px-2 py-1.5 transition-colors",
          selected
            ? "border-accent/30 bg-accent-bg"
            : inCart
              ? "border-accent/20 bg-accent-bg/50"
              : "border-border bg-surface",
        )}
      >
        <div
          className={cn(
            "truncate font-mono text-xs",
            selected ? "font-semibold text-accent-text" : inCart ? "text-accent-text" : "text-text",
          )}
          title={asset.name}
        >
          {truncateMid(asset.name, 20)}
        </div>
        <div
          className={cn(
            "mt-px flex justify-between font-mono text-xs",
            selected ? "text-accent-text/70" : inCart ? "text-accent-text/60" : "text-text-3",
          )}
        >
          <span className="uppercase tracking-wider">{asset.ext}</span>
          <span className="tabular-nums">{formatBytes(asset.size)}</span>
        </div>
      </div>
    </button>
  );
}
