"use client";

import { useState } from "react";
import { PikaWordmark } from "../brand/PikaWordmark";
import { Button } from "../primitives/Button";
import { Kbd } from "../primitives/Kbd";
import { AddSourceDialog } from "./AddSourceDialog";

type Props = { onAdded?: (sourceId: number) => void };

export function EmptyState({ onAdded }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-bg p-10 text-center">
      <PikaWordmark size={36} />

      <div className="max-w-110">
        <div className="mb-1.5 text-lg font-medium tracking-tight text-text">
          No sources indexed
        </div>
        <div className="text-sm leading-relaxed text-text-2">
          Point pika at a local repo to scan every image and icon inside it. Spot the duplicates.
          See where each one is used. Hand the cleanup to a coding agent. Everything stays on your
          machine.
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="primary" className="h-8 px-3.5" onClick={() => setOpen(true)}>
          Add local source…
        </Button>
      </div>

      <div className="mt-4 flex gap-7 font-mono text-xs text-text-3">
        <span>
          <Kbd>⌘</Kbd> <Kbd>K</Kbd> command palette
        </span>
      </div>

      <div className="mt-6 max-w-110 rounded-sm border border-border bg-surface px-3 py-2 text-left font-mono text-xs text-text-3">
        or from the terminal: <span className="text-text">pnpm pika source add /path/to/repo</span>
      </div>

      <AddSourceDialog open={open} onOpenChange={setOpen} onAdded={onAdded} />
    </div>
  );
}
