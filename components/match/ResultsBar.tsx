"use client";

import { PreviewBackdropToggle } from "./PreviewBackdropToggle";
import { ThresholdSlider } from "./ThresholdSlider";

type Props = {
  sourceLabel: string;
  count: number;
  isPending: boolean;
  threshold: number;
  thresholdMax: number;
  onThresholdChange: (next: number) => void;
  thresholdVisible: boolean;
};

export function ResultsBar({
  sourceLabel,
  count,
  isPending,
  threshold,
  thresholdMax,
  onThresholdChange,
  thresholdVisible,
}: Props) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface px-4">
      <span className="font-sans text-sm font-semibold text-text">Matches in {sourceLabel}</span>
      <span className="rounded-xs bg-sunken px-1.5 py-0.5 font-mono text-2xs tabular-nums text-text-2">
        {isPending ? "…" : `${count} found`}
      </span>
      <div className="flex-1" />
      <PreviewBackdropToggle />
      {thresholdVisible ? (
        <>
          <div className="h-4 w-px bg-divider" />
          <ThresholdSlider
            value={threshold}
            min={0}
            max={thresholdMax}
            onChange={onThresholdChange}
          />
        </>
      ) : null}
    </div>
  );
}
