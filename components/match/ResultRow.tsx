"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/time";
import { ArrowRight, Check, Copy } from "../icons";
import type { BucketTone } from "./Bucket";

export type ResultRowData = {
  assetId: number;
  name: string;
  relPath: string;
  ext: string;
  size: number;
  usageCount: number;
  metric: string;
  metricValue: string;
  metricUnit: string;
  pct: number;
  diff: string;
  tone: BucketTone;
  roleLabel: string;
};

type Props = {
  data: ResultRowData;
  droppedName: string;
  droppedPreview: string | null;
  onView: () => void;
};

const METER_FILL: Record<BucketTone, string> = {
  danger: "bg-danger",
  warn: "bg-warn",
  accent: "bg-accent",
  muted: "bg-text-3",
};

const SIDE_LABEL_TONE: Record<BucketTone, string> = {
  danger: "bg-danger-bg text-danger",
  warn: "bg-warn-bg text-warn",
  accent: "bg-accent-bg text-accent-text",
  muted: "bg-sunken text-text-3",
};

export function ResultRow({ data, droppedName, droppedPreview, onView }: Props) {
  const [copied, setCopied] = useState(false);
  const copyPath = async () => {
    await navigator.clipboard.writeText(data.relPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="overflow-hidden rounded-sm border border-border bg-surface">
      <div className="grid grid-cols-[1fr_140px_1fr] items-stretch">
        <RSide
          label="DROPPED"
          name={droppedName}
          sub="from upload"
          tone={data.tone}
          preview={droppedPreview}
        />

        <div className="flex flex-col items-center justify-center gap-1 border-x border-border bg-sunken px-2 py-2.5">
          <span className="font-mono text-3xs uppercase tracking-wider text-text-3">
            {data.metric}
          </span>
          <span className="font-mono text-lg font-semibold leading-none tabular-nums text-text">
            {data.metricValue}
          </span>
          <span className="font-mono text-3xs text-text-3">{data.metricUnit}</span>
          <div className="mt-1 h-[3px] w-25 overflow-hidden rounded-xs bg-border-2">
            <div
              className={cn("h-full", METER_FILL[data.tone])}
              style={{ width: `${Math.max(4, Math.min(100, data.pct))}%` }}
            />
          </div>
        </div>

        <RSide
          label={data.roleLabel}
          name={data.name}
          sub={data.relPath}
          tone={data.tone}
          previewAssetId={data.assetId}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5 border-t border-divider bg-bg px-3 py-1.5">
        <span className="font-mono text-3xs uppercase tracking-wider text-text-3">Diff</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-2" title={data.diff}>
          {data.diff}
        </span>
        <span
          className="font-mono text-3xs tabular-nums text-text-3"
          title={`${data.usageCount} references`}
        >
          {data.usageCount} ref{data.usageCount === 1 ? "" : "s"}
        </span>
        <span className="font-mono text-3xs tabular-nums text-text-3">
          {formatBytes(data.size)}
        </span>
        <button
          type="button"
          onClick={copyPath}
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded-xs border px-2 font-sans text-2xs font-medium transition-colors",
            copied
              ? "border-ok bg-ok-bg text-ok"
              : "border-border bg-surface text-text-2 hover:bg-hover",
          )}
        >
          {copied ? (
            <>
              <Check size={10} strokeWidth={1.75} />
              Copied
            </>
          ) : (
            <>
              <Copy size={10} strokeWidth={1.75} />
              Copy path
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onView}
          className="inline-flex h-6 items-center gap-1 rounded-xs border border-border bg-surface px-2 font-sans text-2xs font-medium text-text-2 transition-colors hover:bg-hover"
        >
          View
          <ArrowRight size={10} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

function RSide({
  label,
  name,
  sub,
  tone,
  preview,
  previewAssetId,
}: {
  label: string;
  name: string;
  sub: string;
  tone: BucketTone;
  preview?: string | null;
  previewAssetId?: number;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 p-2.5">
      <div
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xs border border-border"
        style={{
          backgroundImage:
            "linear-gradient(45deg,#f0efec 25%,transparent 25%),linear-gradient(-45deg,#f0efec 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f0efec 75%),linear-gradient(-45deg,transparent 75%,#f0efec 75%)",
          backgroundSize: "8px 8px",
          backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
        }}
      >
        {preview ? (
          // biome-ignore lint/performance/noImgElement: blob url preview, not a remote asset
          <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
        ) : previewAssetId ? (
          // biome-ignore lint/performance/noImgElement: internal preview endpoint, non-optimizable
          <img
            src={`/api/preview/${previewAssetId}`}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "w-fit rounded-xs px-1.5 py-0.5 font-mono text-3xs font-semibold uppercase tracking-wider",
            SIDE_LABEL_TONE[tone],
          )}
        >
          {label}
        </span>
        <div className="truncate font-mono text-xs font-medium text-text" title={name}>
          {name}
        </div>
        <div className="truncate font-mono text-3xs text-text-3" title={sub}>
          {sub}
        </div>
      </div>
    </div>
  );
}
