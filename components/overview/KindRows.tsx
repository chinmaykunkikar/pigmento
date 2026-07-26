"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { DesignIdentity } from "@/lib/db/queries/identity";
import { type Kind, useKindNav } from "@/lib/hooks/useKindNav";
import { ArrowRight, Image, Palette, Type } from "../icons";

type Metric = { value: string; label: string; danger?: boolean };

type KindRow = {
  kind: Kind;
  icon: ReactNode;
  name: string;
  metrics: Metric[];
};

export function KindRows({ identity }: { identity: DesignIdentity }) {
  const { goToKind } = useKindNav();
  const rows = buildKindRows(identity);

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface shadow-sm">
      {rows.map((r, i) => (
        <button
          key={r.kind}
          type="button"
          onClick={() => goToKind(r.kind)}
          className={cn(
            "group/kind flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-hover",
            i > 0 && "border-t border-divider",
          )}
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm bg-sunken text-text-2">
            {r.icon}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="font-sans text-md font-medium text-text">{r.name}</span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs tabular-nums">
              {r.metrics.map((m) => (
                <span key={m.label} className={m.danger ? "text-danger" : "text-text-3"}>
                  <span className={m.danger ? "text-danger" : "text-text-2"}>{m.value}</span>{" "}
                  {m.label}
                </span>
              ))}
            </div>
          </div>
          <span className="flex flex-shrink-0 items-center gap-1 font-sans text-xs text-text-3 transition-colors group-hover/kind:text-accent">
            Open
            <ArrowRight size={12} strokeWidth={1.75} />
          </span>
        </button>
      ))}
    </div>
  );
}

function pctLabel(pct: number | null): string {
  return pct === null ? "—" : `${Math.round(pct * 100)}%`;
}

function buildKindRows(identity: DesignIdentity): KindRow[] {
  const { colors, typography, images } = identity;
  return [
    {
      kind: "colors",
      icon: <Palette size={16} strokeWidth={1.5} />,
      name: "Colors",
      metrics: [
        { value: pctLabel(colors.coverage.pct), label: "tokenized" },
        { value: colors.distinctColors.toLocaleString(), label: "distinct" },
        {
          value: colors.driftCount.toLocaleString(),
          label: "drift",
          danger: colors.driftCount > 0,
        },
      ],
    },
    {
      kind: "typography",
      icon: <Type size={16} strokeWidth={1.5} />,
      name: "Typography",
      metrics: [
        { value: pctLabel(typography.coverage.pct), label: "tokenized" },
        { value: typography.familyCount.toLocaleString(), label: "families" },
        { value: typography.sizeCount.toLocaleString(), label: "sizes" },
        {
          value: typography.driftCount.toLocaleString(),
          label: "drift",
          danger: typography.driftCount > 0,
        },
      ],
    },
    {
      kind: "images",
      icon: <Image size={16} strokeWidth={1.5} />,
      name: "Images",
      metrics: [
        { value: images.totalAssets.toLocaleString(), label: "assets" },
        {
          value: images.duplicateGroups.toLocaleString(),
          label: "dupes",
          danger: images.duplicateGroups > 0,
        },
        {
          value: images.unusedAssets.toLocaleString(),
          label: "unused",
          danger: images.unusedAssets > 0,
        },
        { value: images.clusters.toLocaleString(), label: "clusters" },
      ],
    },
  ];
}
