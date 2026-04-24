"use client";

import { cn } from "@/lib/cn";
import type { ClusterDetail, NameSibling, NearDuplicate } from "@/lib/db/queries/asset-detail";
import { useExplorerStore } from "@/lib/store";
import { Tag, TriangleAlert } from "../icons";

const MAX_VISIBLE = 10;

type Props = {
  clusters: ClusterDetail[];
  nearDuplicates: NearDuplicate[];
  nameSiblings: NameSibling[];
  currentAssetId: number;
  currentAssetName: string;
};

export function DuplicateGroupSection({
  clusters,
  nearDuplicates,
  nameSiblings,
  currentAssetId,
  currentAssetName,
}: Props) {
  const hashClusters = clusters.filter((c) => c.kind === "hash");
  const hasAny = hashClusters.length > 0 || nearDuplicates.length > 0 || nameSiblings.length > 0;
  if (!hasAny) return null;

  return (
    <div className="border-b border-border">
      {hashClusters.map((c) => (
        <HashBlock
          key={c.id}
          cluster={c}
          currentAssetId={currentAssetId}
          currentAssetName={currentAssetName}
        />
      ))}
      {nearDuplicates.length > 0 ? (
        <NearBlock items={nearDuplicates} currentAssetName={currentAssetName} />
      ) : null}
      {nameSiblings.length > 0 ? (
        <NameBlock items={nameSiblings} currentAssetName={currentAssetName} />
      ) : null}
    </div>
  );
}

function HashBlock({
  cluster,
  currentAssetId,
  currentAssetName,
}: {
  cluster: ClusterDetail;
  currentAssetId: number;
  currentAssetName: string;
}) {
  const openAsset = useExplorerStore((s) => s.openAsset);
  const visible = cluster.members.slice(0, MAX_VISIBLE);
  const hidden = Math.max(0, cluster.members.length - visible.length);

  return (
    <div>
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
        <span className="inline-flex items-center gap-1 text-danger">
          <TriangleAlert size={12} strokeWidth={1.75} />
          <span className="text-2xs font-semibold uppercase tracking-wider">Exact duplicates</span>
        </span>
        <span className="rounded-xs bg-sunken px-1.5 py-px font-mono text-2xs font-medium text-text-2">
          {cluster.size}
        </span>
      </div>
      <div className="px-3 pb-2.5">
        {visible.map((m) => {
          const isCurrent = m.assetId === currentAssetId;
          return (
            <button
              type="button"
              key={m.assetId}
              disabled={isCurrent}
              onClick={() => openAsset(m.assetId, currentAssetName)}
              className="grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-2 border-b border-divider py-1 text-left transition-colors last:border-b-0 hover:bg-hover disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
            >
              <span
                className={cn(
                  "rounded-xs px-1 py-px font-mono text-3xs font-semibold",
                  m.role === "canonical" ? "bg-ok-bg text-ok" : "bg-danger-bg text-danger",
                )}
              >
                {m.role === "canonical" ? "CANONICAL" : "EXACT"}
              </span>
              <span className="truncate font-mono text-xs text-text" title={m.relPath}>
                {m.relPath}
              </span>
              <span className="font-mono text-2xs text-text-3 tabular-nums">
                {(m.size / 1024).toFixed(1)}K
              </span>
              {isCurrent ? (
                <span className="rounded-xs bg-accent-bg px-1 font-mono text-3xs font-medium text-accent-text">
                  THIS
                </span>
              ) : (
                <span />
              )}
            </button>
          );
        })}
        {hidden > 0 ? (
          <div className="mt-1 font-mono text-2xs text-text-3">
            +{hidden} more · open cluster view (coming soon)
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NameBlock({
  items,
  currentAssetName,
}: {
  items: NameSibling[];
  currentAssetName: string;
}) {
  const openAsset = useExplorerStore((s) => s.openAsset);
  const visible = items.slice(0, MAX_VISIBLE);
  const hidden = Math.max(0, items.length - visible.length);

  return (
    <div>
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
        <span className="inline-flex items-center gap-1 text-text-2">
          <Tag size={12} strokeWidth={1.75} />
          <span className="text-2xs font-semibold uppercase tracking-wider">Name family</span>
        </span>
        <span className="rounded-xs bg-sunken px-1.5 py-px font-mono text-2xs font-medium text-text-2">
          {items.length}
        </span>
      </div>
      <div className="px-3 pb-2.5">
        {visible.map((m) => (
          <button
            type="button"
            key={m.assetId}
            onClick={() => openAsset(m.assetId, currentAssetName)}
            className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-divider py-1 text-left transition-colors last:border-b-0 hover:bg-hover"
          >
            <span
              className="truncate rounded-xs bg-sunken px-1 py-px font-mono text-3xs font-medium text-text-2"
              title={`shared: ${m.shared.join(", ")}`}
            >
              {m.shared[0]}
              {m.shared.length > 1 ? `+${m.shared.length - 1}` : ""}
            </span>
            <span className="truncate font-mono text-xs text-text" title={m.relPath}>
              {m.relPath}
            </span>
            <span className="font-mono text-2xs text-text-3 tabular-nums">
              {(m.size / 1024).toFixed(1)}K
            </span>
          </button>
        ))}
        {hidden > 0 ? (
          <div className="mt-1 font-mono text-2xs text-text-3">+{hidden} more</div>
        ) : null}
      </div>
    </div>
  );
}

function NearBlock({
  items,
  currentAssetName,
}: {
  items: NearDuplicate[];
  currentAssetName: string;
}) {
  const openAsset = useExplorerStore((s) => s.openAsset);
  const visible = items.slice(0, MAX_VISIBLE);
  const hidden = Math.max(0, items.length - visible.length);

  return (
    <div>
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
        <span className="inline-flex items-center gap-1 text-warn">
          <TriangleAlert size={12} strokeWidth={1.75} />
          <span className="text-2xs font-semibold uppercase tracking-wider">Near duplicates</span>
        </span>
        <span className="rounded-xs bg-sunken px-1.5 py-px font-mono text-2xs font-medium text-text-2">
          {items.length}
        </span>
      </div>
      <div className="px-3 pb-2.5">
        {visible.map((m) => (
          <button
            type="button"
            key={m.assetId}
            onClick={() => openAsset(m.assetId, currentAssetName)}
            className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-divider py-1 text-left transition-colors last:border-b-0 hover:bg-hover"
          >
            <span className="rounded-xs bg-warn-bg px-1 py-px font-mono text-3xs font-semibold text-warn">
              Δ{m.hamming}
            </span>
            <span className="truncate font-mono text-xs text-text" title={m.relPath}>
              {m.relPath}
            </span>
            <span className="font-mono text-2xs text-text-3 tabular-nums">
              {(m.size / 1024).toFixed(1)}K
            </span>
          </button>
        ))}
        {hidden > 0 ? (
          <div className="mt-1 font-mono text-2xs text-text-3">+{hidden} more</div>
        ) : null}
      </div>
    </div>
  );
}
