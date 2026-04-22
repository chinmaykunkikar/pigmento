import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SegmentedItem<V extends string> = {
  value: V;
  icon?: ReactNode;
  label: string;
  disabled?: boolean;
};

type Props<V extends string> = {
  value: V;
  items: SegmentedItem<V>[];
  onChange: (value: V) => void;
};

export function Segmented<V extends string>({ value, items, onChange }: Props<V>) {
  return (
    <div className="flex h-7 items-center gap-0.5 rounded-sm border border-border bg-surface p-0.5">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            disabled={it.disabled}
            onClick={() => onChange(it.value)}
            className={cn(
              "flex h-full items-center gap-1.5 rounded-xs px-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              active ? "bg-sunken font-semibold text-text" : "text-text-2 hover:bg-hover",
            )}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
