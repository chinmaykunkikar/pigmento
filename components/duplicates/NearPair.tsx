"use client";

import type { NearPairSide, NearPair as NearPairT } from "@/lib/db/queries/duplicates";
import { useExplorerStore } from "@/lib/store";
import { formatBytes } from "@/lib/time";

const CHECKER = {
  backgroundImage:
    "linear-gradient(45deg, var(--color-checker-b) 25%, transparent 25%), linear-gradient(-45deg, var(--color-checker-b) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--color-checker-b) 75%), linear-gradient(-45deg, transparent 75%, var(--color-checker-b) 75%)",
  backgroundSize: "10px 10px",
  backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0",
  backgroundColor: "var(--color-checker-a)",
};

const HASH_BITS = 64;

type Props = { pair: NearPairT };

export function NearPair({ pair }: Props) {
  const similarity = Math.round((1 - pair.hamming / HASH_BITS) * 100);
  const barColor =
    pair.confidence === "high"
      ? "var(--color-ok)"
      : pair.confidence === "medium"
        ? "var(--color-warn)"
        : "var(--color-text-3)";
  const chipColor =
    pair.confidence === "high"
      ? "bg-ok-bg text-ok"
      : pair.confidence === "medium"
        ? "bg-warn-bg text-warn"
        : "bg-sunken-2 text-text-3";

  const diff = computeDiff(pair.a, pair.b);

  return (
    <div className="overflow-hidden rounded-sm border border-border bg-surface">
      <div className="grid grid-cols-[1fr_180px_1fr] items-stretch">
        <NearSide side={pair.a} canonical />

        <div className="flex flex-col items-center justify-center gap-1.5 border-x border-border bg-sunken px-2.5 py-3">
          <div className="font-mono text-2xs tracking-wider text-text-3">HAMMING</div>
          <div className="font-mono text-[28px] font-semibold leading-none text-text tabular-nums">
            {pair.hamming}
          </div>
          <div className="font-mono text-2xs text-text-3">/ 64 bits</div>
          <div className="mt-1 h-[3px] w-30 overflow-hidden rounded-[2px] bg-border-2">
            <div className="h-full" style={{ width: `${similarity}%`, background: barColor }} />
          </div>
          <div className="font-mono text-2xs text-text-2 tabular-nums">{similarity}% similar</div>
          <span
            className={`mt-0.5 rounded-[2px] px-1.5 py-px font-mono text-3xs font-semibold uppercase tracking-wider ${chipColor}`}
          >
            {pair.confidence} confidence
          </span>
        </div>

        <NearSide side={pair.b} />
      </div>

      <div className="flex items-center gap-2.5 border-t border-divider bg-bg px-3 py-1.5">
        <span className="font-mono text-2xs tracking-wider text-text-3">DIFF</span>
        <span className="truncate font-mono text-xs text-text-2">{diff}</span>
        <div className="flex-1" />
        <DiffBtn label="Side-by-side" />
        <DiffBtn label="Overlay" />
        <DiffBtn label="Keep both" />
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-[2px] border-none bg-text px-2.5 py-0.5 font-sans text-xs font-medium text-surface opacity-60"
        >
          Merge into A
        </button>
      </div>
    </div>
  );
}

function NearSide({ side, canonical }: { side: NearPairSide; canonical?: boolean }) {
  const openAsset = useExplorerStore((s) => s.openAsset);
  const zeroRef = side.usageCount === 0;

  return (
    <button
      type="button"
      data-asset-tile="true"
      onClick={() => openAsset(side.assetId)}
      className="flex min-w-0 items-start gap-3 p-3 text-left transition-colors hover:bg-hover"
    >
      <div
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-[2px] border border-border"
        style={CHECKER}
      >
        {/** biome-ignore lint/performance/noImgElement: local preview */}
        <img
          src={`/api/preview/${side.assetId}`}
          alt={side.name}
          loading="lazy"
          draggable={false}
          className="max-h-[75%] max-w-[75%] select-none"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-1 flex items-center gap-1.5">
          <span
            className={`rounded-[2px] px-1.5 py-px font-mono text-3xs font-semibold tracking-wider ${
              canonical ? "bg-accent-bg text-accent-text" : "bg-sunken text-text-3"
            }`}
          >
            {canonical ? "A · CANDIDATE" : "B · PROPOSED DROP"}
          </span>
        </div>
        <div className="truncate font-mono text-xs font-medium text-text" title={side.relPath}>
          {side.relPath}
        </div>
        <div className="mt-1 flex gap-3 font-mono text-2xs text-text-3 tabular-nums">
          <span>{side.width && side.height ? `${side.width}×${side.height}` : "—"}</span>
          <span>{formatBytes(side.size)}</span>
          <span className={zeroRef ? "text-warn" : undefined}>
            {side.usageCount} {side.usageCount === 1 ? "ref" : "refs"}
          </span>
        </div>
      </div>
    </button>
  );
}

function DiffBtn({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="cursor-not-allowed rounded-[2px] border border-border bg-surface px-2 py-0.5 font-sans text-xs text-text-2 opacity-70"
    >
      {label}
    </button>
  );
}

function computeDiff(a: NearPairSide, b: NearPairSide): string {
  const parts: string[] = [];
  if (a.ext !== b.ext) parts.push(`ext ${a.ext} → ${b.ext}`);
  if (a.width && b.width && a.width !== b.width) parts.push(`w ${a.width} → ${b.width}`);
  if (a.height && b.height && a.height !== b.height) parts.push(`h ${a.height} → ${b.height}`);
  const deltaBytes = b.size - a.size;
  if (deltaBytes !== 0) {
    const sign = deltaBytes > 0 ? "+" : "−";
    parts.push(`${sign}${formatBytes(Math.abs(deltaBytes))}`);
  }
  const deltaRefs = b.usageCount - a.usageCount;
  if (deltaRefs !== 0) {
    const sign = deltaRefs > 0 ? "+" : "";
    parts.push(`${sign}${deltaRefs} refs`);
  }
  return parts.length > 0 ? parts.join(" · ") : "metadata identical";
}
