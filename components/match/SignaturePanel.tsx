"use client";

import type { QuerySignature } from "@/lib/match/ext";

type Props = { signature: QuerySignature | null; isPending: boolean };

export function SignaturePanel({ signature, isPending }: Props) {
  if (!signature) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <SigLabel>Signature</SigLabel>
        <p className="font-mono text-xs text-text-3">
          {isPending ? "Computing…" : "Drop a file to see its hash, phash, and vector stats."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <SigLabel>Signature</SigLabel>
      <SigRow k="SHA-1" v={formatHex(signature.sha1, 8)} />
      <SigRow k="Content" v={signature.contentHash} />
      <SigRow k="pHash" v={signature.phash ? formatPhash(signature.phash) : "-"} />
      <SigRow
        k="Bounding"
        v={
          signature.width && signature.height
            ? `${signature.width} × ${signature.height}`
            : "unknown"
        }
      />
      <SigRow
        k="Dominant"
        v={signature.dominantColor ?? "-"}
        swatch={signature.dominantColor ?? undefined}
      />
      {signature.svg ? (
        <SigRow
          k="Vector"
          v={`${signature.svg.pathsCount} path${
            signature.svg.pathsCount === 1 ? "" : "s"
          } · ${signature.svg.commandsCount} cmd${
            signature.svg.commandsCount === 1 ? "" : "s"
          } · ${signature.svg.hasFill ? "fills" : "no fills"}`}
        />
      ) : null}
      {signature.svg?.viewBox ? <SigRow k="ViewBox" v={signature.svg.viewBox} /> : null}
      {signature.svg?.strokeWidths.length ? (
        <SigRow k="Strokes" v={signature.svg.strokeWidths.join(" · ")} />
      ) : null}
    </div>
  );
}

function SigLabel({ children }: { children: string }) {
  return (
    <div className="mb-1.5 font-sans text-2xs font-semibold uppercase tracking-wider text-text-3">
      {children}
    </div>
  );
}

function SigRow({ k, v, swatch }: { k: string; v: string; swatch?: string }) {
  return (
    <div className="grid grid-cols-[64px_1fr] items-baseline gap-2 py-1 text-xs">
      <span className="font-sans text-text-3">{k}</span>
      <span className="inline-flex min-w-0 items-center gap-1.5 truncate font-mono text-xs text-text">
        {swatch ? (
          <span
            className="h-2.5 w-2.5 rounded-xs border border-border"
            style={{ backgroundColor: swatch }}
          />
        ) : null}
        <span className="truncate">{v}</span>
      </span>
    </div>
  );
}

function formatHex(hex: string, groupSize: number): string {
  return hex.match(new RegExp(`.{1,${groupSize}}`, "g"))?.join(" ") ?? hex;
}

function formatPhash(hex: string): string {
  const bits = BigInt(`0x${hex}`).toString(2).padStart(64, "0");
  return bits.match(/.{1,4}/g)?.join(" ") ?? hex;
}
