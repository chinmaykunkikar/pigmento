import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

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
