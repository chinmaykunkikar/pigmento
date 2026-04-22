import type { ReactNode } from "react";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-border">
      <div className="px-3 pb-1.5 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-3">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}
