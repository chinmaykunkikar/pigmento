"use client";

import { Command } from "cmdk";
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { SourceWithMeta } from "@/lib/db/queries/sources";
import { useReindex } from "@/lib/queries/reindex";
import { useExplorerStore } from "@/lib/store";
import {
  Box,
  ChevronLeft,
  ClipboardList,
  Eye,
  EyeOff,
  Layers,
  LayoutGrid,
  RefreshCw,
  ScanSearch,
  Search,
  SquareStack,
  Trash2,
} from "./icons";
import { formatCombo, KbdHint } from "./primitives/KbdHint";

type Props = { source: SourceWithMeta | null };

type Action = {
  id: string;
  label: string;
  hint?: string;
  combo?: string;
  icon: ReactNode;
  group: "View" | "Source" | "Display" | "Plan";
  onRun: () => void;
  enabled: boolean;
};

export function CommandPalette({ source }: Props) {
  const open = useExplorerStore((s) => s.paletteOpen);
  const setOpen = useExplorerStore((s) => s.setPaletteOpen);
  const setView = useExplorerStore((s) => s.setView);
  const boundingBoxes = useExplorerStore((s) => s.boundingBoxes);
  const setBoundingBoxes = useExplorerStore((s) => s.setBoundingBoxes);
  const unusedOnly = useExplorerStore((s) => s.unusedOnly);
  const setUnusedOnly = useExplorerStore((s) => s.setUnusedOnly);
  const focusSearch = useExplorerStore((s) => s.focusSearch);
  const toggleSidebar = useExplorerStore((s) => s.toggleSidebar);
  const sidebarCollapsed = useExplorerStore((s) => s.sidebarCollapsed);
  const clearPlan = useExplorerStore((s) => s.clearPlan);
  const planCount = useExplorerStore((s) => s.draftPlan?.actions.length ?? 0);
  const reindex = useReindex(source?.id ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, setOpen]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  const actions: Action[] = [
    {
      id: "view:grid",
      label: "Go to Grid",
      combo: "1",
      icon: <LayoutGrid size={13} strokeWidth={1.5} />,
      group: "View",
      onRun: run(() => setView("grid")),
      enabled: !!source,
    },
    {
      id: "view:grouped",
      label: "Go to Grouped",
      combo: "2",
      icon: <Layers size={13} strokeWidth={1.5} />,
      group: "View",
      onRun: run(() => setView("grouped")),
      enabled: !!source,
    },
    {
      id: "view:duplicates",
      label: "Go to Duplicates",
      combo: "3",
      icon: <SquareStack size={13} strokeWidth={1.5} />,
      group: "View",
      onRun: run(() => setView("duplicates")),
      enabled: !!source,
    },
    {
      id: "view:match",
      label: "Match a file",
      combo: "4",
      icon: <ScanSearch size={13} strokeWidth={1.5} />,
      group: "View",
      onRun: run(() => setView("match")),
      enabled: !!source,
    },
    {
      id: "view:plan",
      label: planCount > 0 ? `Open cleanup plan · ${planCount}` : "Open cleanup plan",
      combo: "5",
      icon: <ClipboardList size={13} strokeWidth={1.5} />,
      group: "View",
      onRun: run(() => setView("plan")),
      enabled: !!source,
    },
    {
      id: "source:reindex",
      label: reindex.isPending ? "Re-indexing…" : "Re-index source",
      hint: source?.label,
      icon: <RefreshCw size={13} strokeWidth={1.5} />,
      group: "Source",
      onRun: run(() => reindex.mutate({})),
      enabled: !!source && !reindex.isPending,
    },
    {
      id: "source:focus-search",
      label: "Focus search",
      combo: "mod+f",
      icon: <Search size={13} strokeWidth={1.5} />,
      group: "Source",
      onRun: run(focusSearch),
      enabled: !!source,
    },
    {
      id: "display:toggle-bounding",
      label: boundingBoxes ? "Hide bounding boxes" : "Show bounding boxes",
      icon: <Box size={13} strokeWidth={1.5} />,
      group: "Display",
      onRun: run(() => setBoundingBoxes(!boundingBoxes)),
      enabled: !!source,
    },
    {
      id: "display:toggle-unused",
      label: unusedOnly ? "Show all assets" : "Show unused only",
      icon: unusedOnly ? (
        <EyeOff size={13} strokeWidth={1.5} />
      ) : (
        <Eye size={13} strokeWidth={1.5} />
      ),
      group: "Display",
      onRun: run(() => setUnusedOnly(!unusedOnly)),
      enabled: !!source,
    },
    {
      id: "display:toggle-sidebar",
      label: sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar",
      combo: "mod+b",
      icon: <ChevronLeft size={13} strokeWidth={1.5} />,
      group: "Display",
      onRun: run(toggleSidebar),
      enabled: true,
    },
    {
      id: "plan:clear",
      label: "Clear cleanup plan",
      icon: <Trash2 size={13} strokeWidth={1.5} />,
      group: "Plan",
      onRun: run(clearPlan),
      enabled: planCount > 0,
    },
  ];

  const enabled = actions.filter((a) => a.enabled);
  const groups = groupBy(enabled, (a) => a.group);

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 animate-[fade-in_120ms_var(--ease-out-quart)]"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close command palette"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-overlay"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="absolute left-1/2 top-[18%] w-[min(560px,92vw)] overflow-hidden rounded-md border border-border bg-surface [transform:translateX(-50%)] animate-[scale-in_180ms_var(--ease-out-expo)]"
      >
        <Command label="Command palette" shouldFilter>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search size={14} strokeWidth={1.5} className="text-text-3" />
            <Command.Input
              ref={inputRef}
              placeholder="Type a command…"
              className="h-11 flex-1 bg-transparent font-sans text-sm text-text outline-none placeholder:text-text-4"
            />
            <KbdHint keys={["esc"]} />
          </div>
          <Command.List className="max-h-80 overflow-auto p-1.5">
            <Command.Empty className="px-3 py-6 text-center font-sans text-sm text-text-3">
              No commands match.
            </Command.Empty>
            {Object.entries(groups).map(([label, items]) => (
              <Command.Group
                key={label}
                heading={label}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-sans [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-3"
              >
                {items.map((a) => (
                  <Command.Item
                    key={a.id}
                    value={`${a.label} ${a.hint ?? ""}`}
                    onSelect={a.onRun}
                    className="flex h-8 items-center gap-2 rounded-sm px-2 font-sans text-sm text-text aria-selected:bg-accent-bg aria-selected:text-accent-text"
                  >
                    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-text-3 aria-[selected=true]:text-accent-text">
                      {a.icon}
                    </span>
                    <span className="flex-1 truncate">{a.label}</span>
                    {a.hint ? (
                      <span className="truncate font-mono text-xs text-text-3">{a.hint}</span>
                    ) : null}
                    {a.combo ? <KbdHint keys={formatCombo(a.combo)} /> : null}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>,
    document.body,
  );
}

function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const k = key(item);
    if (!out[k]) out[k] = [];
    out[k].push(item);
  }
  return out;
}
