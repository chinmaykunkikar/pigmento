import { z } from "zod";

export const planFormatVersion = "pika/plan v1";

const assetRef = z.object({
  assetId: z.number().int().positive(),
  relPath: z.string().min(1),
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
  usageCount: z.number().int().nonnegative().default(0),
});

const baseAction = z.object({
  id: z.string().min(1),
  createdAt: z.number().int(),
});

const mergeExactAction = baseAction.extend({
  kind: z.literal("merge-exact"),
  hashKey: z.string().min(1),
  keep: assetRef,
  drop: z.array(assetRef).min(1),
});

const mergeClusterAction = baseAction.extend({
  kind: z.literal("merge-cluster"),
  clusterId: z.number().int().positive(),
  clusterKey: z.string().min(1),
  clusterKind: z.enum(["name", "hash", "phash"]),
  keep: assetRef,
  drop: z.array(assetRef).min(1),
});

const deleteUnusedAction = baseAction.extend({
  kind: z.literal("delete-unused"),
  drop: z.array(assetRef).min(1),
});

const reviewGroupAction = baseAction.extend({
  kind: z.literal("review-group"),
  note: z.string().optional(),
  assetRefs: z.array(assetRef).min(1),
});

const renameAssetAction = baseAction.extend({
  kind: z.literal("rename-asset"),
  asset: assetRef,
  newName: z.string().min(1),
  newRelPath: z.string().min(1),
});

export const planAction = z.discriminatedUnion("kind", [
  mergeExactAction,
  mergeClusterAction,
  deleteUnusedAction,
  reviewGroupAction,
  renameAssetAction,
]);

export const planSchema = z.object({
  version: z.literal(planFormatVersion),
  id: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, "plan id must be slug-safe"),
  name: z.string().min(1),
  sourceId: z.number().int().positive(),
  sourceLabel: z.string().min(1),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  actions: z.array(planAction),
});

export type AssetRef = z.infer<typeof assetRef>;
export type PlanAction = z.infer<typeof planAction>;
export type MergeExactAction = z.infer<typeof mergeExactAction>;
export type MergeClusterAction = z.infer<typeof mergeClusterAction>;
export type DeleteUnusedAction = z.infer<typeof deleteUnusedAction>;
export type ReviewGroupAction = z.infer<typeof reviewGroupAction>;
export type RenameAssetAction = z.infer<typeof renameAssetAction>;
export type Plan = z.infer<typeof planSchema>;

export type PlanStats = {
  actionCount: number;
  fileCount: number;
  refCount: number;
  reclaimableBytes: number;
};

export function computeStats(plan: Plan): PlanStats {
  let files = 0;
  let refs = 0;
  let bytes = 0;
  for (const a of plan.actions) {
    if (a.kind === "review-group") continue;
    if (a.kind === "rename-asset") {
      refs += a.asset.usageCount;
      continue;
    }
    files += a.drop.length;
    for (const d of a.drop) {
      refs += d.usageCount;
      bytes += d.size;
    }
  }
  return {
    actionCount: plan.actions.length,
    fileCount: files,
    refCount: refs,
    reclaimableBytes: bytes,
  };
}

export function actionTitle(a: PlanAction): string {
  if (a.kind === "merge-exact") return `Merge duplicates into ${a.keep.name}`;
  if (a.kind === "merge-cluster") return `Merge cluster ${a.clusterKey} into ${a.keep.name}`;
  if (a.kind === "review-group") {
    return `Review ${a.assetRefs.length} flagged asset${a.assetRefs.length === 1 ? "" : "s"}`;
  }
  if (a.kind === "rename-asset") return `Rename ${a.asset.name} → ${a.newName}`;
  return `Delete ${a.drop.length} unused asset${a.drop.length === 1 ? "" : "s"}`;
}
