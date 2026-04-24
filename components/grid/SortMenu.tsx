"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/cn";
import { GRID_SORT_LABELS, GRID_SORT_SHORT, type GridSort, useExplorerStore } from "@/lib/store";
import { Check, ChevronDown } from "../icons";

const ORDER: GridSort[] = [
  "name-asc",
  "name-desc",
  "size-asc",
  "size-desc",
  "mtime-desc",
  "mtime-asc",
];

export function SortMenu() {
  const gridSort = useExplorerStore((s) => s.gridSort);
  const setGridSort = useExplorerStore((s) => s.setGridSort);

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-6 items-center gap-1 rounded-xs px-1.5 font-mono text-xs text-text-3 transition-colors hover:bg-hover hover:text-text aria-expanded:bg-hover aria-expanded:text-text"
        >
          Sort: <span className="text-text">{GRID_SORT_SHORT[gridSort]}</span>
          <ChevronDown size={12} strokeWidth={1.75} className="text-text-3" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-[180px] overflow-hidden rounded-sm border border-border bg-surface p-0.5 data-[state=open]:animate-[fade-in_120ms_var(--ease-out-quart)]"
        >
          {ORDER.map((s) => (
            <Dropdown.Item
              key={s}
              onSelect={() => setGridSort(s)}
              className={cn(
                "flex h-7 items-center gap-2 rounded-xs px-2 font-sans text-xs text-text outline-none",
                "data-[highlighted]:bg-accent-bg data-[highlighted]:text-accent-text",
              )}
            >
              <span className="flex h-3 w-3 flex-shrink-0 items-center justify-center">
                {gridSort === s ? <Check size={12} strokeWidth={1.75} /> : null}
              </span>
              <span className="flex-1">{GRID_SORT_LABELS[s]}</span>
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
