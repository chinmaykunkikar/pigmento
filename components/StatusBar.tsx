"use client";

import { formatBytes } from "../lib/time";

type Props = {
  totalAssets: number;
  totalBytes?: number;
  folderPath: string | null;
  selectionCount?: number;
};

export function StatusBar({ totalAssets, totalBytes, folderPath, selectionCount = 0 }: Props) {
  const left = folderPath
    ? `${totalAssets.toLocaleString()} assets · ${folderPath}`
    : `${totalAssets.toLocaleString()} assets`;
  const right = selectionCount > 0 ? `Selection: ${selectionCount}` : "";
  const mid = typeof totalBytes === "number" ? formatBytes(totalBytes) : "";

  return (
    <div className="flex h-6 flex-shrink-0 items-center gap-4 border-t border-border bg-surface px-3 font-mono text-xs text-text-3">
      <span className="truncate">{left}</span>
      <div className="flex-1 text-center text-text-4">{mid}</div>
      <span>{right}</span>
    </div>
  );
}
