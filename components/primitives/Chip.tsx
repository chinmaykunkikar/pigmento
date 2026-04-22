import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-7 items-center gap-1.5 rounded-sm border border-border bg-surface px-2">
      <span className="text-xs text-text-3">{label}</span>
      <div className="flex gap-0.5">{children}</div>
    </div>
  );
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
};

export function Chip({ label, active, className, ...props }: Props) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "min-w-[18px] rounded-xs px-1.5 py-0.5 text-xs font-medium transition-colors",
        active ? "bg-text text-surface" : "bg-transparent text-text-2 hover:bg-hover",
        className,
      )}
    >
      {label}
    </button>
  );
}
