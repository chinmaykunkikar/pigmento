import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  leading?: ReactNode;
  trailing?: ReactNode;
  containerClassName?: string;
};

export function Input({ leading, trailing, containerClassName, className, ...props }: Props) {
  return (
    <div
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-sm border border-border bg-sunken pl-2 text-sm focus-within:border-accent/40",
        containerClassName,
      )}
    >
      {leading ? <span className="text-text-3">{leading}</span> : null}
      <input
        {...props}
        className={cn(
          "h-full flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-4",
          className,
        )}
      />
      {trailing ? <span>{trailing}</span> : null}
    </div>
  );
}
