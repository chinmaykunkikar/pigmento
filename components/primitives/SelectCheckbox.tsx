"use client";

import { cn } from "@/lib/cn";
import { Check } from "../icons";

type Props = {
  checked: boolean;
  onToggle: () => void;
  label?: string;
  className?: string;
  size?: "sm" | "md";
};

export function SelectCheckbox({ checked, onToggle, label, className, size = "md" }: Props) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: native input cannot nest inside a <button> parent tile; span with role=checkbox + keyboard handlers avoids the HTML nesting violation that caused hydration errors
    <span
      role="checkbox"
      aria-checked={checked}
      aria-label={label ?? (checked ? "Remove from selection" : "Add to selection")}
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }
      }}
      className={cn(
        "inline-flex shrink-0 cursor-pointer select-none items-center justify-center rounded-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
        checked
          ? "border-accent bg-accent text-white"
          : "border-border-2 bg-surface text-transparent hover:border-text-3",
        className,
      )}
    >
      <Check size={size === "sm" ? 9 : 11} strokeWidth={3} />
    </span>
  );
}
