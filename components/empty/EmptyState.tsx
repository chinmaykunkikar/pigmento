"use client";

import { useState } from "react";
import { Button } from "../primitives/Button";
import { Kbd } from "../primitives/Kbd";
import { AddSourceDialog } from "./AddSourceDialog";

type Props = { onAdded?: (sourceId: number) => void };

export function EmptyState({ onAdded }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-bg p-10 text-center">
      <div className="grid h-30 w-30 grid-cols-3 gap-px rounded-sm border border-dashed border-border-2 bg-sunken p-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static decorative grid
            key={i}
            className="rounded-xs bg-surface"
            style={{ opacity: 0.3 + (i % 3) * 0.15 }}
          />
        ))}
      </div>

      <div className="max-w-110">
        <div className="mb-1.5 text-lg font-medium tracking-tight text-text">
          No sources indexed
        </div>
        <div className="text-sm leading-relaxed text-text-2">
          Point the explorer at a local repo to start scanning icons, images, and other static
          assets. Everything stays on your machine, nothing is uploaded.
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="primary" className="h-8 px-3.5" onClick={() => setOpen(true)}>
          Add local source…
        </Button>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-sm border border-border-2 bg-surface px-3.5 text-sm font-medium text-text opacity-50"
        >
          Clone from Git URL…
          <span className="rounded-xs bg-sunken px-1 font-mono text-3xs text-text-3">SOON</span>
        </button>
      </div>

      <div className="mt-4 flex gap-7 font-mono text-xs text-text-3">
        <span>
          <Kbd>⌘</Kbd> <Kbd>K</Kbd> command palette
        </span>
      </div>

      <div className="mt-6 max-w-110 rounded-sm border border-border bg-surface px-3 py-2 text-left font-mono text-xs text-text-3">
        or from the terminal: <span className="text-text">pnpm pdx source add /path/to/repo</span>
      </div>

      <AddSourceDialog open={open} onOpenChange={setOpen} onAdded={onAdded} />
    </div>
  );
}
