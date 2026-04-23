"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BucketTone = "danger" | "warn" | "accent" | "ok" | "muted";

type Props = {
  label: string;
  badge?: string;
  note?: string;
  tone: BucketTone;
  children?: ReactNode;
};

const BADGE_TONE: Record<BucketTone, string> = {
  danger: "bg-danger-bg text-danger",
  warn: "bg-warn-bg text-warn",
  accent: "bg-accent-bg text-accent-text",
  ok: "bg-ok-bg text-ok",
  muted: "bg-sunken text-text-3",
};

export function Bucket({ label, badge, note, tone, children }: Props) {
  return (
    <section className="px-4 pt-3">
      <div className="mb-1.5 flex items-center gap-2">
        <h3 className="font-sans text-xs font-semibold text-text">{label}</h3>
        {badge ? (
          <span
            className={cn(
              "rounded-xs px-1.5 py-0.5 font-mono text-3xs font-semibold uppercase tracking-wider",
              BADGE_TONE[tone],
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>
      {note ? <p className="mb-2 font-sans text-xs leading-relaxed text-text-3">{note}</p> : null}
      {children ? <div className="flex flex-col gap-1.5 pb-1">{children}</div> : null}
    </section>
  );
}
