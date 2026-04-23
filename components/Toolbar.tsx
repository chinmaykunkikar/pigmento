"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { SourceWithMeta } from "@/lib/db/queries/sources";
import { useReindex } from "@/lib/queries/reindex";
import {
  EXT_FILTERS,
  type ExtFilter,
  type SizeBucket,
  useExplorerStore,
  type View,
} from "@/lib/store";
import { relativeTime } from "@/lib/time";
import { Box, ClipboardList, Layers, LayoutGrid, RefreshCw, Search, SquareStack, X } from "./icons";
import { Chip, ChipGroup } from "./primitives/Chip";
import { IconBtn } from "./primitives/IconBtn";
import { formatCombo, KbdHint } from "./primitives/KbdHint";
import { TypePill } from "./primitives/Pill";
import { Segmented } from "./primitives/Segmented";
import { Toggle } from "./primitives/Toggle";

type Props = {
  source: SourceWithMeta | null;
  indexerProgress: number | null;
};

const SIZE_BUCKETS: { value: SizeBucket; label: string }[] = [
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
];

const EXT_LABELS: Record<ExtFilter, string> = {
  svg: "SVG",
  png: "PNG",
  jpg: "JPG",
  webp: "WebP",
  gif: "GIF",
};

export function Toolbar({ source, indexerProgress }: Props) {
  const view = useExplorerStore((s) => s.view);
  const setView = useExplorerStore((s) => s.setView);
  const boundingBoxes = useExplorerStore((s) => s.boundingBoxes);
  const setBoundingBoxes = useExplorerStore((s) => s.setBoundingBoxes);
  const unusedOnly = useExplorerStore((s) => s.unusedOnly);
  const setUnusedOnly = useExplorerStore((s) => s.setUnusedOnly);
  const search = useExplorerStore((s) => s.search);
  const setSearch = useExplorerStore((s) => s.setSearch);
  const extFilter = useExplorerStore((s) => s.extFilter);
  const toggleExtFilter = useExplorerStore((s) => s.toggleExtFilter);
  const sizeBucket = useExplorerStore((s) => s.sizeBucket);
  const setSizeBucket = useExplorerStore((s) => s.setSizeBucket);
  const reindex = useReindex(source?.id ?? null);
  const planCount = useExplorerStore((s) =>
    s.draftPlan && s.draftPlan.sourceId === (source?.id ?? -1) ? s.draftPlan.actions.length : 0,
  );
  const searchFocusNonce = useExplorerStore((s) => s.searchFocusNonce);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchFocusNonce === 0) return;
    searchRef.current?.focus();
    searchRef.current?.select();
  }, [searchFocusNonce]);

  const planBadge = () => (planCount > 0 ? `Plan · ${planCount}` : "Plan");

  const filterActive =
    search.length > 0 || extFilter.length > 0 || sizeBucket !== null || unusedOnly;

  return (
    <div className="relative flex h-11 flex-shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <div
        className={cn(
          "flex h-7 min-w-55 max-w-90 flex-1 items-center gap-1.5 rounded-sm border bg-sunken pl-2 pr-1 focus-within:border-accent/40",
          search ? "border-accent/30" : "border-border",
        )}
      >
        <Search size={13} strokeWidth={1.5} className="flex-shrink-0 text-text-3" />
        <input
          ref={searchRef}
          placeholder="Search assets, paths, hashes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-4"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="flex-shrink-0 rounded-xs p-0.5 text-text-3 hover:bg-hover hover:text-text-2"
            aria-label="Clear search"
          >
            <X size={12} strokeWidth={1.75} />
          </button>
        ) : (
          <KbdHint keys={formatCombo("mod+f")} className="flex-shrink-0" />
        )}
      </div>

      <ChipGroup label="Type">
        <div className="flex gap-0.5">
          {EXT_FILTERS.map((ext) => (
            <TypePill
              key={ext}
              label={EXT_LABELS[ext]}
              active={extFilter.includes(ext)}
              onClick={() => toggleExtFilter(ext)}
            />
          ))}
        </div>
      </ChipGroup>

      <ChipGroup label="Size">
        {SIZE_BUCKETS.map((b) => (
          <Chip
            key={b.value}
            label={b.label}
            active={sizeBucket === b.value}
            onClick={() => setSizeBucket(sizeBucket === b.value ? null : b.value)}
          />
        ))}
      </ChipGroup>

      <Toggle label="Unused only" on={unusedOnly} onClick={() => setUnusedOnly(!unusedOnly)} />

      {filterActive ? (
        <button
          type="button"
          onClick={() => useExplorerStore.getState().clearFilters()}
          className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-2 font-mono text-xs text-text-3 transition-colors hover:bg-hover hover:text-text-2"
          title="Clear all filters"
        >
          <X size={11} strokeWidth={1.75} />
          clear
        </button>
      ) : null}

      <div className="flex-1" />

      <Segmented<View>
        value={view}
        onChange={setView}
        items={[
          { value: "grid", icon: <LayoutGrid size={13} strokeWidth={1.5} />, label: "Grid" },
          {
            value: "grouped",
            icon: <Layers size={13} strokeWidth={1.5} />,
            label: "Grouped",
          },
          {
            value: "duplicates",
            icon: <SquareStack size={13} strokeWidth={1.5} />,
            label: "Duplicates",
          },
          {
            value: "plan",
            icon: <ClipboardList size={13} strokeWidth={1.5} />,
            label: planBadge(),
          },
        ]}
      />

      <IconBtn
        label="Bounding boxes"
        active={boundingBoxes}
        onClick={() => setBoundingBoxes(!boundingBoxes)}
      >
        <Box size={14} strokeWidth={1.5} strokeDasharray="2 2" />
      </IconBtn>

      <div className="mx-1 h-5 w-px shrink-0 bg-border" />

      {source ? (
        <span className="shrink-0 whitespace-nowrap font-mono text-xs text-text-3 tabular-nums">
          Indexed {relativeTime(source.lastIndexedAt ?? source.createdAt)}
        </span>
      ) : null}

      <button
        type="button"
        disabled={reindex.isPending || !source}
        onClick={() => reindex.mutate({})}
        className="inline-flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border border-border-2 bg-surface px-2.5 text-sm font-medium text-text transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw
          size={12}
          strokeWidth={1.5}
          className={cn(reindex.isPending && "animate-spin")}
        />
        {reindex.isPending ? "Indexing…" : "Re-index"}
      </button>

      {indexerProgress !== null ? (
        <div className="-bottom-px pointer-events-none absolute right-0 left-0 h-0.5 bg-sunken">
          <div
            className="h-full bg-accent transition-[width] duration-400"
            style={{ width: `${Math.min(100, Math.max(0, indexerProgress))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
