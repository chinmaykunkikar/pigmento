import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  on?: boolean;
};

export function Toggle({ label, on, className = "", ...props }: Props) {
  return (
    <button
      type="button"
      {...props}
      aria-pressed={on ?? false}
      className={`inline-flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
        on
          ? "border-accent/40 bg-accent-bg text-accent-text"
          : "border-border bg-surface text-text-2 hover:bg-hover"
      } ${className}`}
    >
      <span
        className={`h-2 w-2 rounded-full border-[1.5px] ${
          on ? "border-accent bg-accent" : "border-text-3 bg-transparent"
        }`}
      />
      {label}
    </button>
  );
}
