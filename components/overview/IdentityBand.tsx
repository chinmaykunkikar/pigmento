"use client";

import type { DesignIdentity } from "@/lib/db/queries/identity";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { relativeTime } from "@/lib/time";
import { Download } from "../icons";
import { PaletteHero } from "./PaletteHero";

type Props = {
  identity: DesignIdentity | null;
  sourceLabel: string | null;
  lastIndexedAt: string | null;
  indexing: boolean;
  playSignature: boolean;
};

export function IdentityBand({
  identity,
  sourceLabel,
  lastIndexedAt,
  indexing,
  playSignature,
}: Props) {
  const pct = identity?.colors.coverage.pct ?? null;
  const hasCoverage = identity !== null && pct !== null;
  const shown = useCountUp(hasCoverage ? pct * 100 : 0, {
    play: playSignature && hasCoverage,
  });

  return (
    <section className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-3xs uppercase tracking-wider text-text-3">
            Design identity
          </div>
          {sourceLabel ? (
            <h1 className="mt-1 truncate font-sans text-2xl text-text">{sourceLabel}</h1>
          ) : (
            <h1 className="mt-1 font-sans text-2xl text-text-4">your codebase</h1>
          )}
          {identity && lastIndexedAt ? (
            <p className="mt-0.5 font-mono text-xs text-text-3">
              indexed {relativeTime(lastIndexedAt)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled
          title="Poster export lands in a later slice"
          className="inline-flex h-7 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border border-border bg-surface px-2.5 font-sans text-sm font-medium text-text-3 shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download size={12} strokeWidth={1.5} />
          Poster
        </button>
      </header>

      <PaletteHero palette={identity?.palette ?? null} />

      <div className="flex min-h-14 items-end gap-4">
        {hasCoverage ? (
          <>
            <div className="font-mono text-hero tabular-nums tracking-tight text-text">
              {shown.toFixed(1)}
              <span className="text-text-3">%</span>
            </div>
            <p className="mb-2 max-w-140 text-pretty font-sans text-sm text-text-2">
              of the colors in <span className="text-text">{sourceLabel}</span> resolve to a token.
              The other{" "}
              <span className="font-mono tabular-nums text-text">
                {identity.colors.coverage.literal.toLocaleString()}
              </span>{" "}
              are literals sitting next to the tokens they should use.
            </p>
          </>
        ) : identity ? (
          <p className="max-w-140 font-sans text-sm text-text-2">
            No tokenized colors were found. Add CSS variables or a theme and re-index to see
            coverage.
          </p>
        ) : indexing ? (
          <p className="font-mono text-sm text-text-3">Reading {sourceLabel ?? "your repo"}…</p>
        ) : (
          <p className="max-w-140 text-pretty font-sans text-lg text-text-2">
            Point pigmento at a repo.{" "}
            <span className="text-text">See the design system it actually has.</span>
          </p>
        )}
      </div>
    </section>
  );
}
