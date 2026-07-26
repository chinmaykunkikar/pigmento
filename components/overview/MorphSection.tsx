import type { ReactNode } from "react";

// Collapse/expand by animating grid-template-rows 0fr <-> 1fr with an
// overflow-hidden inner (A7): no max-height guessing, no layout thrash.
export function MorphSection({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-500 ease-out"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      aria-hidden={!open}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
