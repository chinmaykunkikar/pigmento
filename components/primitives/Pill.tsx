import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
};

export function TypePill({ label, active, className = "", ...props }: Props) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-xs px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider transition-colors ${
        active ? "bg-text text-surface" : "bg-transparent text-text-3 hover:bg-hover"
      } ${className}`}
    >
      {label}
    </button>
  );
}
