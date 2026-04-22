"use client";

import { formatBytes } from "../../lib/time";

type Props = {
  sourceLabel: string;
  folderPath: string | null;
  assetCount: number;
  totalBytes: number;
  onSelect: (path: string) => void;
};

export function BreadcrumbBar({
  sourceLabel,
  folderPath,
  assetCount,
  totalBytes,
  onSelect,
}: Props) {
  const parts = folderPath ? folderPath.split("/").filter(Boolean) : [];

  return (
    <div className="flex h-8 flex-shrink-0 items-center gap-2 border-b border-border bg-surface px-4">
      <span className="font-mono text-xs text-text-3">
        <button
          type="button"
          onClick={() => onSelect("")}
          className={parts.length === 0 ? "text-text" : "hover:text-text"}
        >
          {sourceLabel}
        </button>
        {parts.map((p, i) => {
          const path = parts.slice(0, i + 1).join("/");
          const last = i === parts.length - 1;
          return (
            <span key={path}>
              <span className="text-text-4"> / </span>
              <button
                type="button"
                onClick={() => onSelect(path)}
                className={last ? "text-text" : "hover:text-text"}
              >
                {p}
              </button>
            </span>
          );
        })}
      </span>

      <div className="flex-1" />

      <span className="font-mono text-xs text-text-3 tabular-nums">
        {assetCount.toLocaleString()} assets · {formatBytes(totalBytes)}
      </span>
      <span className="h-3 w-px bg-border" />
      <span className="text-xs text-text-3">
        Sort: <span className="text-text">Name ↑</span>
      </span>
    </div>
  );
}
