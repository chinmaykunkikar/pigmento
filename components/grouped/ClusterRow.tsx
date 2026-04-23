"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { Group } from "@/lib/db/queries/groups";
import type { MergeClusterAction } from "@/lib/plan/schema";
import { useExplorerStore } from "@/lib/store";
import { ChevronDown, ChevronRight } from "../icons";
import { AddToPlanButton } from "../plan/AddToPlanButton";
import { VariantTable } from "./VariantTable";
import { VariantTile } from "./VariantTile";

type Props = { group: Group; sourceId: number; sourceLabel: string };

export function ClusterRow({ group, sourceId, sourceLabel }: Props) {
  const [open, setOpen] = useState(false);
  const selectedAssetId = useExplorerStore((s) => s.selectedAssetId);
  const openAsset = useExplorerStore((s) => s.openAsset);

  const containsSelected = group.members.some((m) => m.assetId === selectedAssetId);
  const unusedCount = group.members.filter((m) => m.usageCount === 0).length;

  const canonical = group.members.find((m) => m.role === "canonical") ?? group.members[0];
  const action: MergeClusterAction | null = canonical
    ? {
        id: `merge-cluster:${group.id}`,
        kind: "merge-cluster",
        createdAt: Date.now(),
        clusterId: group.id,
        clusterKey: group.key,
        clusterKind: group.kind,
        keep: {
          assetId: canonical.assetId,
          relPath: canonical.relPath,
          name: canonical.name,
          size: canonical.size,
          usageCount: canonical.usageCount,
        },
        drop: group.members
          .filter((m) => m.assetId !== canonical.assetId)
          .map((m) => ({
            assetId: m.assetId,
            relPath: m.relPath,
            name: m.name,
            size: m.size,
            usageCount: m.usageCount,
          })),
      }
    : null;

  return (
    <div className="border-b border-border">
      {/* biome-ignore lint/a11y/useSemanticElements: native button would nest the Add-to-plan button */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {open ? (
          <ChevronDown size={12} strokeWidth={1.75} className="text-text-3" />
        ) : (
          <ChevronRight size={12} strokeWidth={1.75} className="text-text-3" />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-mono text-xs font-medium",
            containsSelected ? "text-accent-text" : "text-text",
          )}
          title={group.key}
        >
          {group.key}
        </span>
        <span className="flex items-center gap-1 rounded-xs bg-sunken px-1.5 py-px font-mono text-2xs font-medium text-text-2">
          ×{group.size}
        </span>
        {unusedCount > 0 ? (
          <span className="rounded-xs bg-warn-bg px-1.5 py-px font-mono text-2xs font-medium text-warn">
            {unusedCount} unused
          </span>
        ) : null}
        {action && action.drop.length > 0 ? (
          <AddToPlanButton
            action={action}
            sourceId={sourceId}
            sourceLabel={sourceLabel}
            size="sm"
          />
        ) : null}
      </div>

      {open ? (
        <div className="space-y-2 px-3 pb-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {group.members.map((m) => (
              <VariantTile
                key={m.assetId}
                member={m}
                selected={m.assetId === selectedAssetId}
                onClick={() => openAsset(m.assetId)}
              />
            ))}
          </div>
          <VariantTable
            members={group.members}
            selectedAssetId={selectedAssetId}
            onRowClick={openAsset}
          />
        </div>
      ) : null}
    </div>
  );
}
