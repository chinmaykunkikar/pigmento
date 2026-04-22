"use client";

import { cn } from "@/lib/cn";
import type { AssetSummary } from "@/lib/db/queries/folders";
import { truncateMid } from "@/lib/text";
import { formatBytes } from "@/lib/time";

const CHECKER = {
  backgroundImage:
    "linear-gradient(45deg, var(--color-checker-b) 25%, transparent 25%), linear-gradient(-45deg, var(--color-checker-b) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--color-checker-b) 75%), linear-gradient(-45deg, transparent 75%, var(--color-checker-b) 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
  backgroundColor: "var(--color-checker-a)",
};

const SELECTED_SHADOW = "var(--shadow-tile-selected)";

type Props = {
  asset: AssetSummary;
  selected?: boolean;
  showBoundingBox?: boolean;
  onClick?: () => void;
};

export function AssetTile({ asset, selected, showBoundingBox, onClick }: Props) {
  return (
    <button
      type="button"
      data-asset-tile="true"
      onClick={onClick}
      style={selected ? { boxShadow: SELECTED_SHADOW } : undefined}
      className={cn(
        "relative flex cursor-pointer flex-col overflow-hidden rounded-xs border border-border bg-surface text-left transition-[box-shadow,border-color,transform] duration-150 ease-out will-change-transform hover:border-border-2 active:scale-[0.97]",
        selected && "z-10 border-transparent",
      )}
    >
      <div className="relative flex min-h-25 flex-1 items-center justify-center" style={CHECKER}>
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
          selected ? "border-accent/30 bg-accent-bg" : "border-border bg-surface",
        )}
      >
        <div
          className={cn(
            "truncate font-mono text-xs",
            selected ? "font-semibold text-accent-text" : "text-text",
          )}
          title={asset.name}
        >
          {truncateMid(asset.name, 20)}
        </div>
        <div
          className={cn(
            "mt-px flex justify-between font-mono text-xs",
            selected ? "text-accent-text/70" : "text-text-3",
          )}
        >
          <span className="uppercase tracking-wider">{asset.ext}</span>
          <span className="tabular-nums">{formatBytes(asset.size)}</span>
        </div>
      </div>
    </button>
  );
}
