"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import type { Source } from "../../lib/db/schema";
import { AddSourceDialog } from "../empty/AddSourceDialog";
import { ChevronDown, FolderPlus } from "../icons";

type Props = {
  sources: Source[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function SourceSwitcher({ sources, selectedId, onSelect }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const selected = sources.find((s) => s.id === selectedId) ?? sources[0];

  if (!selected) return null;

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex h-[30px] w-full cursor-pointer items-center gap-2 rounded-sm border border-border bg-sunken px-2.5 text-left hover:bg-hover"
          >
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="truncate text-xs font-medium leading-tight text-text">
                {selected.label}
              </div>
              <div className="mt-px truncate font-mono text-[10px] leading-tight text-text-3">
                {sources.length === 1 ? "1 source" : `${sources.length} sources`}
              </div>
            </div>
            <ChevronDown size={10} strokeWidth={1.5} className="flex-shrink-0 text-text-3" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={4}
            align="start"
            className="z-40 min-w-[240px] rounded-sm border border-border bg-surface p-1 shadow-lg"
          >
            {sources.map((s) => (
              <DropdownMenu.Item
                key={s.id}
                onSelect={() => onSelect(s.id)}
                className="flex cursor-pointer items-center gap-2 rounded-xs px-2 py-1.5 text-sm text-text outline-none data-[highlighted]:bg-hover"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    s.id === selected.id ? "bg-accent" : "bg-border-2"
                  }`}
                />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span className="truncate font-mono text-[10px] text-text-4">{s.root}</span>
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item
              onSelect={() => setAddOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-xs px-2 py-1.5 text-sm text-text outline-none data-[highlighted]:bg-hover"
            >
              <FolderPlus size={12} strokeWidth={1.5} />
              Add source…
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <AddSourceDialog open={addOpen} onOpenChange={setAddOpen} onAdded={(id) => onSelect(id)} />
    </>
  );
}
