"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { QuerySignature } from "@/lib/match/ext";
import { formatBytes } from "@/lib/time";
import { Upload, X } from "../icons";

type Props = {
  file: File | null;
  signature: QuerySignature | null;
  isPending: boolean;
  onClear: () => void;
  onPick: (file: File) => void;
};

export function DropCard({ file, signature, isPending, onClear, onPick }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file) {
    return (
      <div className="flex flex-col gap-2 px-4 py-3">
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border border-border-2 border-dashed bg-sunken px-4 py-8 text-center transition-colors",
            "hover:border-accent hover:bg-accent-bg/40",
          )}
        >
          <Upload size={14} strokeWidth={1.5} className="text-text-3" />
          <div className="flex flex-col gap-0.5">
            <span className="font-sans text-sm text-text">Drop a file here</span>
            <span className="font-mono text-2xs text-text-3">
              or click to pick · paste ⌘V · SVG PNG JPG WebP GIF
            </span>
          </div>
          <input
            type="file"
            accept=".svg,.png,.jpg,.jpeg,.webp,.gif,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="relative rounded-sm border border-accent border-dashed bg-accent-bg/60 p-3.5">
        <span className="absolute right-1.5 top-1.5 rounded-xs bg-surface px-1.5 py-0.5 font-mono text-3xs font-semibold uppercase tracking-wider text-accent-text">
          {isPending ? "Matching" : "Dropped"}
        </span>

        <div className="flex items-center gap-3.5">
          <div
            className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xs border border-border bg-surface"
            style={{
              backgroundImage:
                "linear-gradient(45deg,#f0efec 25%,transparent 25%),linear-gradient(-45deg,#f0efec 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f0efec 75%),linear-gradient(-45deg,transparent 75%,#f0efec 75%)",
              backgroundSize: "12px 12px",
              backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
            }}
          >
            {preview ? (
              // biome-ignore lint/performance/noImgElement: local blob URL, not a remote asset
              <img src={preview} alt={file.name} className="max-h-full max-w-full object-contain" />
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="truncate font-mono text-sm font-semibold text-text">{file.name}</div>
            <div className="font-mono text-2xs text-text-3">from upload</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {signature?.width && signature?.height ? (
                <Chip k={`${signature.width} × ${signature.height}`} />
              ) : null}
              <Chip k={formatBytes(file.size)} />
              <Chip
                k={
                  signature?.ext?.toUpperCase() ??
                  file.name.split(".").pop()?.toUpperCase() ??
                  "FILE"
                }
              />
              {signature?.dominantColor ? (
                <Chip k={signature.dominantColor} swatch={signature.dominantColor} />
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-1.5">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-6 flex-1 items-center justify-center gap-1 rounded-xs border border-border-2 bg-surface font-sans text-xs font-medium text-text-2 transition-colors hover:bg-hover"
          >
            <X size={12} strokeWidth={1.75} />
            Clear
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 font-mono text-2xs text-text-3">
        <Upload size={12} strokeWidth={1.5} />
        <span>Drop another file · paste ⌘V</span>
      </div>
    </div>
  );
}

function Chip({ k, swatch }: { k: string; swatch?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-xs border border-border bg-surface px-1.5 py-0.5 font-mono text-2xs text-text-2">
      {swatch ? (
        <span
          className="h-2 w-2 rounded-xs border border-border"
          style={{ backgroundColor: swatch }}
        />
      ) : null}
      {k}
    </span>
  );
}
