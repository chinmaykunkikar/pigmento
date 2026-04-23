"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isAllowedExt } from "@/lib/match/ext";
import { useMatch } from "@/lib/queries/match";
import { useExplorerStore } from "@/lib/store";
import { Bucket } from "./Bucket";
import { DropCard } from "./DropCard";
import { ResultRow, type ResultRowData } from "./ResultRow";
import { ResultsBar } from "./ResultsBar";
import { SignaturePanel } from "./SignaturePanel";

const NEAR_THRESHOLD_DEFAULT = 12;
const NEAR_THRESHOLD_MAX = 20;

type Props = { sourceId: number; sourceLabel: string };

export function MatchView({ sourceId, sourceLabel }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(NEAR_THRESHOLD_DEFAULT);
  const match = useMatch();
  const openAsset = useExplorerStore((s) => s.openAsset);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setRejectReason(null);
    match.reset();
  };

  const onPick = useCallback((next: File) => {
    if (!isAllowedExt(next.name)) {
      setRejectReason(`${next.name}: unsupported file type`);
      return;
    }
    setRejectReason(null);
    setFile(next);
  }, []);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!file) return;
    match.mutate({ file, sourceId });
  }, [file, sourceId, match.mutate]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            onPick(f);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onPick]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const first = e.dataTransfer.files?.[0];
    if (first) onPick(first);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const clipEnabled = match.data?.clipEnabled ?? false;
  const buckets = useBuckets(match.data?.buckets, threshold);
  const total =
    buckets.exact.length +
    buckets.near.length +
    buckets.name.length +
    (clipEnabled ? buckets.semantic.length : 0);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target spans the view, not a button
    <div onDrop={onDrop} onDragOver={onDragOver} className="flex min-h-0 flex-1">
      <aside className="flex w-110 shrink-0 flex-col border-r border-border bg-surface">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="font-sans text-sm font-semibold text-text">Find a match</div>
          <div className="mt-0.5 font-sans text-xs leading-relaxed text-text-3">
            Drop any SVG, PNG, JPG, or WebP. We'll find exact duplicates, near matches, and name
            clusters{clipEnabled ? ", plus anything that shares the same visual concept" : ""}.
          </div>
        </div>
        <DropCard
          file={file}
          signature={match.data?.signature ?? null}
          isPending={match.isPending}
          onClear={reset}
          onPick={onPick}
        />
        {rejectReason ? (
          <div className="border-l-[3px] border-l-warn bg-warn-bg px-4 py-2 font-mono text-xs text-warn">
            {rejectReason}
          </div>
        ) : null}
        <SignaturePanel signature={match.data?.signature ?? null} isPending={match.isPending} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ResultsBar
          sourceLabel={sourceLabel}
          count={total}
          isPending={match.isPending}
          threshold={threshold}
          thresholdMax={NEAR_THRESHOLD_MAX}
          onThresholdChange={setThreshold}
          thresholdVisible={!!match.data}
        />
        <div className="flex-1 overflow-y-auto">
          {!file ? (
            <EmptyHint />
          ) : match.isPending ? (
            <LoadingHint />
          ) : match.error ? (
            <ErrorHint message={match.error.message} />
          ) : match.data ? (
            <BucketList
              buckets={buckets}
              clipEnabled={clipEnabled}
              threshold={threshold}
              droppedName={file.name}
              droppedPreview={preview}
              onView={(id) => openAsset(id)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

type MappedBuckets = ReturnType<typeof useBuckets>;

function BucketList({
  buckets,
  clipEnabled,
  threshold,
  droppedName,
  droppedPreview,
  onView,
}: {
  buckets: MappedBuckets;
  clipEnabled: boolean;
  threshold: number;
  droppedName: string;
  droppedPreview: string | null;
  onView: (assetId: number) => void;
}) {
  const hasAny =
    buckets.exact.length > 0 ||
    buckets.near.length > 0 ||
    buckets.name.length > 0 ||
    (clipEnabled && buckets.semantic.length > 0);
  return (
    <div className="flex flex-col gap-3 pb-6">
      <Bucket
        label="Exact content match"
        badge={countBadge(buckets.exact.length, "match", "matches")}
        tone="danger"
        note={
          buckets.exact.length > 0
            ? "Byte-identical. Do not add. Reuse the existing asset."
            : undefined
        }
      >
        {buckets.exact.map((r) => (
          <ResultRow
            key={r.assetId}
            data={r}
            droppedName={droppedName}
            droppedPreview={droppedPreview}
            onView={() => onView(r.assetId)}
          />
        ))}
      </Bucket>

      <Bucket
        label={`Near matches · pHash Δ ≤ ${threshold}`}
        badge={countBadge(buckets.near.length, "match", "matches")}
        tone="warn"
        note={
          buckets.near.length > 0
            ? "Visually similar. Consider merging instead of adding another variant."
            : undefined
        }
      >
        {buckets.near.map((r) => (
          <ResultRow
            key={r.assetId}
            data={r}
            droppedName={droppedName}
            droppedPreview={droppedPreview}
            onView={() => onView(r.assetId)}
          />
        ))}
      </Bucket>

      <Bucket
        label="Same-named clusters"
        badge={countBadge(buckets.name.length, "related", "related")}
        tone="accent"
        note={
          buckets.name.length > 0
            ? "Existing assets with a similar canonical name. Your file likely belongs here."
            : undefined
        }
      >
        {buckets.name.map((r) => (
          <ResultRow
            key={r.assetId}
            data={r}
            droppedName={droppedName}
            droppedPreview={droppedPreview}
            onView={() => onView(r.assetId)}
          />
        ))}
      </Bucket>

      {clipEnabled ? (
        <Bucket
          label="Semantic matches"
          badge={countBadge(buckets.semantic.length, "match", "matches")}
          tone="ok"
          note={
            buckets.semantic.length > 0
              ? "Shares visual concept even if the geometry differs. Likely the same icon, redrawn."
              : undefined
          }
        >
          {buckets.semantic.map((r) => (
            <ResultRow
              key={r.assetId}
              data={r}
              droppedName={droppedName}
              droppedPreview={droppedPreview}
              onView={() => onView(r.assetId)}
            />
          ))}
        </Bucket>
      ) : null}

      {!hasAny ? (
        <Bucket
          label="Nothing matches"
          tone="muted"
          note={
            clipEnabled
              ? "No hash, phash, name, or semantic overlap with any indexed asset. Looks like a genuine new addition."
              : "No hash, phash, or name overlap with any indexed asset. Looks like a genuine new addition."
          }
        />
      ) : null}
    </div>
  );
}

type RawBuckets = {
  exact: {
    assetId: number;
    name: string;
    relPath: string;
    ext: string;
    size: number;
    usageCount: number;
  }[];
  near: {
    assetId: number;
    name: string;
    relPath: string;
    ext: string;
    size: number;
    usageCount: number;
    hamming: number;
    pct: number;
  }[];
  name: {
    assetId: number;
    name: string;
    relPath: string;
    ext: string;
    size: number;
    usageCount: number;
    score: number;
    sharedTokens: string[];
  }[];
  semantic: {
    assetId: number;
    name: string;
    relPath: string;
    ext: string;
    size: number;
    usageCount: number;
    score: number;
  }[];
};

function useBuckets(
  raw: RawBuckets | undefined,
  threshold: number,
): {
  exact: ResultRowData[];
  near: ResultRowData[];
  name: ResultRowData[];
  semantic: ResultRowData[];
} {
  return useMemo(() => {
    if (!raw) return { exact: [], near: [], name: [], semantic: [] };
    return {
      exact: raw.exact.map<ResultRowData>((r) => ({
        assetId: r.assetId,
        name: r.name,
        relPath: r.relPath,
        ext: r.ext,
        size: r.size,
        usageCount: r.usageCount,
        metric: "SHA-1",
        metricValue: "✓",
        metricUnit: "byte-identical",
        pct: 100,
        diff: "Same bytes. Reuse the existing file, do not commit this one.",
        tone: "danger",
        roleLabel: "CANONICAL",
      })),
      near: raw.near
        .filter((r) => r.hamming <= threshold)
        .map<ResultRowData>((r) => ({
          assetId: r.assetId,
          name: r.name,
          relPath: r.relPath,
          ext: r.ext,
          size: r.size,
          usageCount: r.usageCount,
          metric: "pHash Δ",
          metricValue: String(r.hamming),
          metricUnit: "/ 64 bits",
          pct: r.pct,
          diff: `${r.pct}% visual similarity`,
          tone: "warn",
          roleLabel: "NEAR",
        })),
      name: raw.name.map<ResultRowData>((r) => ({
        assetId: r.assetId,
        name: r.name,
        relPath: r.relPath,
        ext: r.ext,
        size: r.size,
        usageCount: r.usageCount,
        metric: "NAME",
        metricValue: "≈",
        metricUnit: r.sharedTokens.join(" "),
        pct: Math.round(r.score * 100),
        diff: `Shares: ${r.sharedTokens.join(", ")}`,
        tone: "accent",
        roleLabel: "CLUSTER",
      })),
      semantic: raw.semantic.map<ResultRowData>((r) => {
        const pct = Math.round(r.score * 100);
        return {
          assetId: r.assetId,
          name: r.name,
          relPath: r.relPath,
          ext: r.ext,
          size: r.size,
          usageCount: r.usageCount,
          metric: "COSINE",
          metricValue: String(pct),
          metricUnit: "% similar",
          pct,
          diff: "Semantically similar; shares visual concept, different geometry.",
          tone: "ok",
          roleLabel: "SEMANTIC",
        };
      }),
    };
  }, [raw, threshold]);
}

function countBadge(n: number, singular: string, plural: string): string | undefined {
  if (n === 0) return undefined;
  return `${n} ${n === 1 ? singular : plural}`;
}

function EmptyHint() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="max-w-md text-center font-sans text-sm text-text-3">
        Drop a file in the left pane, pick one with the file picker, or paste ⌘V. We'll compute its
        hash, phash, and name tokens, then surface any indexed asset that comes close.
      </p>
    </div>
  );
}

function LoadingHint() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="font-mono text-sm text-text-3">Computing signature and matching…</p>
    </div>
  );
}

function ErrorHint({ message }: { message: string }) {
  return (
    <div className="m-4 rounded-sm border border-border border-l-[3px] border-l-danger bg-danger-bg px-3 py-2 font-mono text-xs text-danger">
      {message}
    </div>
  );
}
