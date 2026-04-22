"use client";

import { cn } from "@/lib/cn";

type Props = {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
};

export function DupTab({ label, count, active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px flex h-9 cursor-pointer items-center gap-1.5 border-b-2 px-3.5 text-sm transition-colors",
        active
          ? "border-accent font-semibold text-text"
          : "border-transparent text-text-3 hover:text-text-2",
      )}
    >
      {label}
      <span className="rounded-sm bg-sunken px-1.5 py-px font-mono text-2xs font-medium text-text-2">
        {count}
      </span>
    </button>
  );
}
