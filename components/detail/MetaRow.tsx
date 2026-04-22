"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Copy } from "../icons";

type Props = {
  k: string;
  v?: string;
  mono?: boolean;
  copy?: string;
  pill?: boolean;
  children?: ReactNode;
};

export function MetaRow({ k, v = "", mono, copy, pill, children }: Props) {
  return (
    <div className="grid grid-cols-[92px_1fr_auto] items-baseline gap-2 px-3 py-1 text-xs">
      <span className="text-text-3">{k}</span>
      {children ? (
        children
      ) : pill ? (
        <span className="w-fit rounded-xs bg-sunken px-1.5 py-px font-mono text-2xs font-medium text-text">
          {v}
        </span>
      ) : (
        <span className={cn("truncate text-xs text-text", mono && "font-mono")} title={v}>
          {v}
        </span>
      )}
      {copy ? (
        <button
          type="button"
          aria-label="Copy"
          onClick={() => navigator.clipboard.writeText(copy)}
          className="flex h-4 w-4 items-center justify-center text-text-3 hover:text-text"
        >
          <Copy size={11} strokeWidth={1.5} />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
