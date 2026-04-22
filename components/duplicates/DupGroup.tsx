"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { ExactGroup } from "@/lib/db/queries/duplicates";
import { useExplorerStore } from "@/lib/store";
import { formatBytes } from "@/lib/time";
import { ChevronDown, ChevronRight } from "../icons";

const CHECKER = {
  backgroundImage:
    "linear-gradient(45deg, var(--color-checker-b) 25%, transparent 25%), linear-gradient(-45deg, var(--color-checker-b) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--color-checker-b) 75%), linear-gradient(-45deg, transparent 75%, var(--color-checker-b) 75%)",
  backgroundSize: "10px 10px",
  backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0",
  backgroundColor: "var(--color-checker-a)",
};

type Props = { group: ExactGroup; defaultOpen: boolean };

export function DupGroup({ group, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const openAsset = useExplorerStore((s) => s.openAsset);
  const shortHash = `${group.key.slice(0, 10)}…`;

  return (
    <div className="overflow-hidden rounded-sm border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-hover",
          open && "border-b border-border",
        )}
      >
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xs border border-border"
          style={CHECKER}
        >
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

        <span className="inline-flex h-6 flex-shrink-0 items-center rounded-sm border border-border-2 bg-surface px-2 font-mono text-xs font-medium text-text">
          Review
        </span>

        {open ? (
          <ChevronDown size={12} strokeWidth={1.75} className="flex-shrink-0 text-text-3" />
        ) : (
          <ChevronRight size={12} strokeWidth={1.75} className="flex-shrink-0 text-text-3" />
        )}
      </button>

      {open ? (
        <div>
          {group.members.map((m, i) => {
            const canonical = m.role === "canonical";
            const zeroRef = m.usageCount === 0;
            return (
              <button
                type="button"
                key={m.assetId}
                data-asset-tile="true"
                onClick={() => openAsset(m.assetId)}
                className={cn(
                  "grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-1.5 pl-16 pr-3 text-left font-mono text-xs transition-colors hover:bg-hover",
                  i !== 0 && "border-t border-divider",
                )}
              >
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
