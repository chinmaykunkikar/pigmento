"use client";

import type { Source } from "../lib/db/schema";
import { useReindex } from "../lib/queries/reindex";
import { useExplorerStore, type View } from "../lib/store";
import { relativeTime } from "../lib/time";
import { Box, Layers, LayoutGrid, RefreshCw, Search, SquareStack } from "./icons";
import { Chip, ChipGroup } from "./primitives/Chip";
import { IconBtn } from "./primitives/IconBtn";
import { TypePill } from "./primitives/Pill";
import { Segmented } from "./primitives/Segmented";
import { Toggle } from "./primitives/Toggle";

type Props = {
  source: Source | null;
};

const TYPES = ["SVG", "PNG", "JPG", "WebP"] as const;

export function Toolbar({ source }: Props) {
  const view = useExplorerStore((s) => s.view);
  const setView = useExplorerStore((s) => s.setView);
  const boundingBoxes = useExplorerStore((s) => s.boundingBoxes);
  const setBoundingBoxes = useExplorerStore((s) => s.setBoundingBoxes);
  const unusedOnly = useExplorerStore((s) => s.unusedOnly);
  const setUnusedOnly = useExplorerStore((s) => s.setUnusedOnly);
  const search = useExplorerStore((s) => s.search);
  const setSearch = useExplorerStore((s) => s.setSearch);
  const reindex = useReindex(source?.id ?? null);

  return (
    <div className="relative flex h-11 flex-shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      <div className="flex h-7 min-w-[280px] items-center gap-1.5 rounded-sm border border-border bg-sunken pl-2 focus-within:border-accent/40">
        <Search size={13} strokeWidth={1.5} className="text-text-3" />
        <input
          placeholder="Search assets, paths, hashes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-full flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-4"
        />
        <div className="flex gap-0.5 pr-1">
          {TYPES.map((t) => (
            <TypePill key={t} label={t} active={t === "SVG" || t === "PNG"} />
          ))}
        </div>
      </div>

      <ChipGroup label="Size">
        <Chip label="S" />
        <Chip label="M" active />
        <Chip label="L" />
      </ChipGroup>

      <Toggle label="Unused only" on={unusedOnly} onClick={() => setUnusedOnly(!unusedOnly)} />

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
            disabled: true,
          },
          {
            value: "duplicates",
            icon: <SquareStack size={13} strokeWidth={1.5} />,
            label: "Duplicates",
            disabled: true,
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

      <div className="mx-1 h-5 w-px bg-border" />

      {source ? (
        <span className="font-mono text-xs text-text-3 tabular-nums">
          Indexed {relativeTime(source.createdAt)}
        </span>
      ) : null}

      <button
        type="button"
        disabled={reindex.isPending || !source}
        onClick={() => reindex.mutate({})}
        className="inline-flex h-[26px] items-center gap-1.5 rounded-sm border border-border-2 bg-surface px-2.5 text-sm font-medium text-text transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw
          size={12}
          strokeWidth={1.5}
          className={reindex.isPending ? "animate-spin" : ""}
        />
        {reindex.isPending ? "Indexing…" : "Re-index"}
      </button>
    </div>
  );
}
