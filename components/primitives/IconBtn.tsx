import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  children: ReactNode;
};

export function IconBtn({ label, active, className, children, ...props }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        active
          ? "border-border bg-sunken text-text"
          : "border-transparent bg-transparent text-text-2 hover:bg-hover",
        className,
      )}
    >
      {children}
    </button>
  );
}
