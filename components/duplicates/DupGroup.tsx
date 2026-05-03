"use client";

import { type MouseEvent, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { ExactGroup } from "@/lib/db/queries/duplicates";
import { mergeExactActionFromGroup } from "@/lib/plan/build";
import { useExplorerStore } from "@/lib/store";
import { formatBytes } from "@/lib/time";
import { ChevronDown, ChevronRight } from "../icons";
import { AddToPlanButton } from "../plan/AddToPlanButton";
import { SelectCheckbox } from "../primitives/SelectCheckbox";

type Props = {
  group: ExactGroup;
  defaultOpen: boolean;
  sourceId: number;
  sourceLabel: string;
};

export function DupGroup({ group, defaultOpen, sourceId, sourceLabel }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const openAsset = useExplorerStore((s) => s.openAsset);
  const cartIds = useExplorerStore((s) => s.cartIds);
  const toggleCartItem = useExplorerStore((s) => s.toggleCartItem);
  const setCartRange = useExplorerStore((s) => s.setCartRange);
  const addToCart = useExplorerStore((s) => s.addToCart);
  const removeFromCart = useExplorerStore((s) => s.removeFromCart);
  const shortHash = `${group.key.slice(0, 10)}…`;

  const cartSet = useMemo(() => new Set(cartIds), [cartIds]);
  const orderedIds = useMemo(() => group.members.map((m) => m.assetId), [group.members]);
  const cartActive = cartIds.length > 0;
  const selectedInGroup = orderedIds.filter((id) => cartSet.has(id)).length;
  const allInCart = selectedInGroup === orderedIds.length && orderedIds.length > 0;

  const action = mergeExactActionFromGroup(group);

  const handleMemberClick = (id: number, e: MouseEvent) => {
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
    openAsset(id);
  };

  return (
    <div className="overflow-hidden rounded-sm border border-border bg-surface">
      {/* biome-ignore lint/a11y/useSemanticElements: native button would nest the Add-to-plan button */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
          open && "border-b border-border",
        )}
      >
        <SelectCheckbox
          checked={allInCart}
          onToggle={() => (allInCart ? removeFromCart(orderedIds) : addToCart(orderedIds))}
          label={allInCart ? "Deselect all copies" : "Select all copies"}
        />

        <div className="bg-checker flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xs border border-border [--checker-size:10px]">
          {/** biome-ignore lint/performance/noImgElement: local preview */}
          <img
            src={`/api/preview/${group.canonicalId}`}
            alt={group.canonicalName}
            loading="lazy"
            draggable={false}
            className="max-h-[70%] max-w-[70%] select-none"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span
              className="truncate font-mono text-base font-medium text-text"
              title={group.canonicalName}
            >
              {group.canonicalName}
            </span>
            <span className="flex-shrink-0 rounded-sm bg-sunken px-1.5 py-px font-mono text-2xs font-medium text-text-2">
              ×{group.count} copies
            </span>
            {selectedInGroup > 0 ? (
              <span className="flex-shrink-0 rounded-sm bg-accent-bg px-1.5 py-px font-mono text-2xs font-medium text-accent-text">
                {selectedInGroup} selected
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 font-mono text-2xs text-text-3" title={group.key}>
            {shortHash} · {formatBytes(group.perFileSize)} each
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="font-mono text-xs text-text-3">reclaimable</div>
          <div className="font-mono text-base font-semibold text-text tabular-nums">
            {formatBytes(group.reclaimableBytes)}
          </div>
        </div>

        <AddToPlanButton action={action} sourceId={sourceId} sourceLabel={sourceLabel} size="sm" />

        {open ? (
          <ChevronDown size={12} strokeWidth={1.75} className="flex-shrink-0 text-text-3" />
        ) : (
          <ChevronRight size={12} strokeWidth={1.75} className="flex-shrink-0 text-text-3" />
        )}
      </div>

      {open ? (
        <div>
          {group.members.map((m, i) => {
            const canonical = m.role === "canonical";
            const zeroRef = m.usageCount === 0;
            const inCart = cartSet.has(m.assetId);
            return (
              <button
                type="button"
                key={m.assetId}
                data-asset-tile="true"
                onClick={(e) => handleMemberClick(m.assetId, e)}
                className={cn(
                  "group/dup-row grid w-full grid-cols-[auto_auto_1fr_auto_auto] items-center gap-3 py-1.5 pl-16 pr-3 text-left font-mono text-xs transition-colors hover:bg-hover",
                  i !== 0 && "border-t border-divider",
                  inCart && "bg-accent-bg/40",
                )}
              >
                <span
                  className={cn(
                    "transition-opacity duration-150",
                    cartActive || inCart
                      ? "opacity-100"
                      : "opacity-0 group-hover/dup-row:opacity-100 group-focus-within/dup-row:opacity-100",
                  )}
                >
                  <SelectCheckbox
                    checked={inCart}
                    onToggle={() => toggleCartItem(m.assetId)}
                    label={m.name}
                    size="sm"
                  />
                </span>
                <span
                  className={cn(
                    "rounded-xs px-1.5 py-px text-3xs font-semibold tracking-wider",
                    canonical ? "bg-accent-bg text-accent-text" : "bg-sunken text-text-3",
                  )}
                >
                  {canonical ? "CANONICAL" : "DUPLICATE"}
                </span>
                <span className="truncate text-text" title={m.relPath}>
                  {m.relPath}
                </span>
                <span
                  className={cn("tabular-nums", zeroRef ? "text-warn" : "text-text-3")}
                  title={`${m.usageCount} references`}
                >
                  {m.usageCount} {m.usageCount === 1 ? "ref" : "refs"}
                </span>
                <span className="rounded-xs border border-border bg-surface px-1.5 py-px text-2xs text-text-2 hover:bg-hover">
                  diff
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
