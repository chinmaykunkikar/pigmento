"use client";

import { cn } from "@/lib/cn";
import type { SizeVariant } from "@/lib/db/queries/asset-detail";
import { useExplorerStore } from "@/lib/store";

type Props = {
  currentSize: number | null;
  variants: SizeVariant[];
};

export function SizePips({ currentSize, variants }: Props) {
  const openAsset = useExplorerStore((s) => s.openAsset);
  if (variants.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {variants.map((v) => {
        const isActive = currentSize === v.size;
        return (
          <button
            key={`${v.assetId}-${v.size}`}
            type="button"
            onClick={() => openAsset(v.assetId)}
            aria-pressed={isActive}
            className={cn(
              "h-[26px] min-w-[38px] rounded-xs border px-2 font-mono text-xs font-medium transition-colors",
              isActive
                ? "border-text bg-text text-surface"
                : "border-border-2 bg-surface text-text-2 hover:bg-hover",
            )}
          >
            {v.size}
          </button>
        );
      })}
    </div>
  );
}
