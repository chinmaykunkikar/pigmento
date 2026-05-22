"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/cn";
import {
  PREVIEW_BACKDROP_CYCLE,
  PREVIEW_BACKDROP_LABELS,
  type PreviewBackdrop,
  useExplorerStore,
} from "@/lib/store";
import { Contrast } from "../icons";

export function PreviewBackdropToggle() {
  const backdrop = useExplorerStore((s) => s.previewBackdrop);
  const setBackdrop = useExplorerStore((s) => s.setPreviewBackdrop);

  return (
    <div className="flex items-center gap-1.5" title="Preview backdrop">
      <Contrast size={12} strokeWidth={1.5} className="text-text-3" />
      <ToggleGroup.Root
        type="single"
        value={backdrop}
        onValueChange={(next) => {
          if (next) setBackdrop(next as PreviewBackdrop);
        }}
        aria-label="Preview backdrop"
        className="flex h-6 items-center overflow-hidden rounded-xs border border-border-2"
      >
        {PREVIEW_BACKDROP_CYCLE.map((value) => (
          <ToggleGroup.Item
            key={value}
            value={value}
            className={cn(
              "h-full border-r border-border px-2 font-mono text-2xs transition-colors last:border-r-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40",
              backdrop === value
                ? "bg-sunken-2 font-semibold text-text"
                : "bg-surface text-text-2 hover:bg-hover",
            )}
          >
            {PREVIEW_BACKDROP_LABELS[value]}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}
