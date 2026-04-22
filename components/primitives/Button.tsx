import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

const styles: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-text disabled:opacity-50 disabled:cursor-not-allowed",
  secondary:
    "bg-surface text-text border border-border-2 hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed",
  ghost:
    "bg-transparent text-text-2 hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed",
};

export function Button({ variant = "secondary", className, children, ...props }: Props) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        styles[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
