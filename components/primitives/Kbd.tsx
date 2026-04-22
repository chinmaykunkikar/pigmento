import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[18px] items-center justify-center rounded-xs border border-border bg-surface px-1 font-mono text-2xs text-text-3">
      {children}
    </kbd>
  );
}
