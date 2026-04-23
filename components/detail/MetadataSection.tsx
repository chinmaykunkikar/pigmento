"use client";

import { useState } from "react";
import type { Asset } from "@/lib/db/schema";
import { formatBytes, relativeTime } from "@/lib/time";
import { Copy } from "../icons";

type Props = { asset: Asset };

export function MetadataSection({ asset }: Props) {
  const [copied, setCopied] = useState<"path" | "sha1" | null>(null);

  const dims = asset.width && asset.height ? `${asset.width} × ${asset.height}` : "—";
  const modifiedRel = relativeTime(new Date(asset.mtime).toISOString());
  const sha1Short = `${asset.sha1.slice(0, 7)}…${asset.sha1.slice(-6)}`;

  const copy = async (kind: "path" | "sha1", text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="flex flex-col gap-2 border-b border-border px-3 py-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className="min-w-0 flex-1 truncate font-mono text-xs text-text-2"
          title={asset.relPath}
        >
          {asset.relPath}
        </span>
        <button
          type="button"
          onClick={() => copy("path", asset.relPath)}
          aria-label="Copy path"
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-xs text-text-3 transition-colors hover:bg-hover hover:text-text"
        >
          {copied === "path" ? (
            <span className="font-mono text-3xs text-ok">✓</span>
          ) : (
            <Copy size={11} strokeWidth={1.5} />
          )}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
        <Stat label="Dimensions" value={dims} />
        <Stat label="Filesize" value={formatBytes(asset.size)} />
        <Stat label="Modified" value={modifiedRel} sub={asset.author ?? undefined} />
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded-xs bg-sunken px-1.5 py-px font-mono text-3xs font-medium uppercase tracking-wider text-text-2">
          {asset.category}
        </span>
        <button
          type="button"
          onClick={() => copy("sha1", asset.sha1)}
          title={copied === "sha1" ? "Copied" : asset.sha1}
          className="inline-flex items-center gap-1 rounded-xs font-mono text-3xs text-text-3 transition-colors hover:text-text-2"
        >
          sha1 {copied === "sha1" ? "copied" : sha1Short}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-3xs font-medium uppercase tracking-wider text-text-3">{label}</span>
      <span
        className="truncate font-mono text-xs text-text"
        title={sub ? `${value} · ${sub}` : value}
      >
        {value}
      </span>
      {sub ? (
        <span className="truncate font-mono text-3xs text-text-3" title={sub}>
          by {sub}
        </span>
      ) : null}
    </div>
  );
}
