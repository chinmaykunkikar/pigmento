"use client";

import type { MouseEvent } from "react";
import { cn } from "@/lib/cn";
import type { GroupMember } from "@/lib/db/queries/groups";
import { relativeTime } from "@/lib/time";
import { SelectCheckbox } from "../primitives/SelectCheckbox";

type Props = {
  members: GroupMember[];
  selectedAssetId: number | null;
  cartSet: ReadonlySet<number>;
  cartActive: boolean;
  onRowClick: (id: number, e: MouseEvent) => void;
  onToggleCart: (id: number) => void;
};

export function VariantTable({
  members,
  selectedAssetId,
  cartSet,
  cartActive,
  onRowClick,
  onToggleCart,
}: Props) {
  return (
    <div className="overflow-hidden rounded-xs border border-border">
      <div className="grid grid-cols-[auto_auto_1fr_auto_auto_auto_auto] items-center gap-3 border-b border-border bg-sunken px-3 py-1.5 font-mono text-2xs font-semibold uppercase tracking-wider text-text-3">
        <span className="w-4" aria-hidden />
        <span className="w-14">Role</span>
        <span>Path</span>
        <span className="text-right">Size</span>
        <span className="text-right">Used</span>
        <span className="text-right">Dims</span>
        <span className="text-right">Modified</span>
      </div>
      {members.map((m) => {
        const isSelected = m.assetId === selectedAssetId;
        const inCart = cartSet.has(m.assetId);
        const zero = m.usageCount === 0;
        return (
          <button
            type="button"
            key={m.assetId}
            data-asset-tile="true"
            onClick={(e) => onRowClick(m.assetId, e)}
            className={cn(
              "group/row grid w-full grid-cols-[auto_auto_1fr_auto_auto_auto_auto] items-center gap-3 border-b border-divider px-3 py-1.5 text-left transition-colors last:border-b-0 hover:bg-hover",
              isSelected && "bg-accent-bg",
              inCart && !isSelected && "bg-accent-bg/50",
            )}
          >
            <span
              className={cn(
                "transition-opacity duration-150",
                cartActive || inCart
                  ? "opacity-100"
                  : "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100",
              )}
            >
              <SelectCheckbox
                checked={inCart}
                onToggle={() => onToggleCart(m.assetId)}
                label={m.name}
                size="sm"
              />
            </span>
            <span
              className={cn(
                "w-14 truncate rounded-xs px-1 py-px text-center font-mono text-3xs font-semibold",
                m.role === "canonical" ? "bg-ok-bg text-ok" : "bg-sunken text-text-3",
              )}
            >
              {m.role === "canonical" ? "CANONICAL" : "VARIANT"}
            </span>
            <span
              className={cn(
                "truncate font-mono text-xs",
                isSelected ? "text-accent-text" : "text-text",
              )}
              title={m.relPath}
            >
              {m.relPath}
            </span>
            <span className="text-right font-mono text-2xs text-text-3 tabular-nums">
              {(m.size / 1024).toFixed(1)}K
            </span>
            <span
              className={cn(
                "text-right font-mono text-2xs tabular-nums",
                zero ? "text-warn" : "text-text-2",
              )}
            >
              {zero ? "unused" : `${m.usageCount}×`}
            </span>
            <span className="text-right font-mono text-2xs text-text-3 tabular-nums">
              {m.width && m.height ? `${m.width}×${m.height}` : "-"}
            </span>
            <span className="text-right font-mono text-2xs text-text-3 tabular-nums">
              {relativeTime(new Date(m.mtime).toISOString())}
            </span>
          </button>
        );
      })}
    </div>
  );
}
