"use client";

import type { DesignIdentity } from "@/lib/db/queries/identity";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { relativeTime } from "@/lib/time";
import { Download } from "../icons";

type Props = {
  identity: DesignIdentity;
  sourceLabel: string;
  lastIndexedAt: string | null;
  playSignature: boolean;
};

export function IdentityBand({ identity, sourceLabel, lastIndexedAt, playSignature }: Props) {
  const pct = identity.colors.coverage.pct;
  const hasCoverage = pct !== null;
  const shown = useCountUp(hasCoverage ? pct * 100 : 0, { play: playSignature && hasCoverage });
  const { literal } = identity.colors.coverage;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-3xs uppercase tracking-wider text-text-3">
            Design identity
          </div>
          <h1 className="mt-1 truncate font-sans text-2xl text-text">{sourceLabel}</h1>
          {lastIndexedAt ? (
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

      <PaletteHero identity={identity} />

      <div className="flex items-end gap-4">
        {hasCoverage ? (
          <div className="font-mono text-hero tabular-nums text-text tracking-tight">
            {shown.toFixed(1)}
            <span className="text-text-3">%</span>
          </div>
        ) : (
          <div className="font-mono text-2xl text-text-3">no color tokens yet</div>
        )}
        <p className="mb-2 max-w-140 text-pretty font-sans text-sm text-text-2">
          {hasCoverage ? (
            <>
              of the colors in <span className="text-text">{sourceLabel}</span> resolve to a token.
              The other{" "}
              <span className="font-mono tabular-nums text-text">{literal.toLocaleString()}</span>{" "}
              are literals sitting next to the tokens they should use.
            </>
          ) : (
            "No tokenized colors were found. Add CSS variables or a theme and re-index to see coverage."
          )}
        </p>
      </div>
    </section>
  );
}

function PaletteHero({ identity }: { identity: DesignIdentity }) {
  const palette = identity.palette;
  if (palette.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center rounded-md border border-border bg-sunken font-mono text-xs text-text-3">
        no palette extracted
      </div>
    );
  }
  return (
    <div className="flex h-20 gap-1 overflow-hidden rounded-md shadow-sm">
      {palette.map((c) => (
        <div
          key={c.color}
          className="relative min-w-0 flex-1"
          style={{ background: c.color }}
          title={`${c.color} · ${c.usageCount.toLocaleString()} uses · ${c.distinctFileCount} files`}
        >
          <code className="absolute bottom-1.5 left-1.5 font-mono text-3xs text-white mix-blend-difference">
            {c.color}
          </code>
        </div>
      ))}
    </div>
  );
}
