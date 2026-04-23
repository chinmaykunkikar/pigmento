import { z } from "zod";

export const planFormatVersion = "pixeldex/plan v1";

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

export const planAction = z.discriminatedUnion("kind", [
  mergeExactAction,
  mergeClusterAction,
  deleteUnusedAction,
]);

export const planSchema = z.object({
  version: z.literal(planFormatVersion),
  id: z.string().min(1),
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
  return `Delete ${a.drop.length} unused asset${a.drop.length === 1 ? "" : "s"}`;
}
