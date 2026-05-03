import type { ExactGroup } from "@/lib/db/queries/duplicates";
import type { MergeExactAction } from "@/lib/plan/schema";

export function mergeExactActionFromGroup(group: ExactGroup): MergeExactAction {
  const canonical = group.members.find((m) => m.assetId === group.canonicalId);
  return {
    id: `merge-exact:${group.id}`,
    kind: "merge-exact",
    createdAt: Date.now(),
    hashKey: group.key,
    keep: {
      assetId: group.canonicalId,
      relPath: canonical?.relPath ?? group.canonicalName,
      name: group.canonicalName,
      size: group.perFileSize,
      usageCount: canonical?.usageCount ?? 0,
    },
    drop: group.members
      .filter((m) => m.assetId !== group.canonicalId)
      .map((m) => ({
        assetId: m.assetId,
        relPath: m.relPath,
        name: m.name,
        size: m.size,
        usageCount: m.usageCount,
      })),
  };
}
