import { stat } from "node:fs/promises";
import { eq } from "drizzle-orm";
import type { Config } from "../config/schema";
import type { Db } from "../db/client";
import { type Asset, assets, type Source } from "../db/schema";
import { hashCluster } from "./cluster-hash";
import { nameCluster } from "./cluster-name";
import { phashCluster } from "./cluster-phash";
import { rebuildClusters } from "./cluster-store";
import { rebuildFts } from "./fts";
import { scanUsages } from "./usage";
import { rebuildUsages } from "./usage-store";

export type ReindexResult = {
  usageCount: number;
  clusterCounts: { name: number; hash: number; phash: number };
};

export async function reindexAfterRename(
  db: Db,
  source: Source,
  config: Config,
  newAbsPath: string,
  assetId: number,
): Promise<ReindexResult> {
  try {
    const s = await stat(newAbsPath);
    db.update(assets)
      .set({ mtime: Math.round(s.mtimeMs) })
      .where(eq(assets.id, assetId))
      .run();
  } catch {}

  const allAssets: Asset[] = db.select().from(assets).where(eq(assets.sourceId, source.id)).all();

  const hits = await scanUsages({
    sourceId: source.id,
    codeRoots: [source.root, ...config.codeRoots],
    ignore: config.ignore,
    assets: allAssets,
    maxHitsPerAsset: config.usage.maxHitsPerAsset,
  });
  const usageCount = rebuildUsages(db, source.id, hits);

  const nameIt = nameCluster(allAssets.map((a) => ({ id: a.id, stem: a.stem })));
  const hashIt = hashCluster(
    allAssets.map((a) => ({ id: a.id, contentHash: a.contentHash, relPath: a.relPath })),
  );
  const phashIt = phashCluster(
    allAssets
      .filter((a): a is Asset & { phash: string } => !!a.phash)
      .map((a) => ({ id: a.id, ext: a.ext, phash: a.phash })),
    config.phash.maxHamming,
  );
  const clusterCounts = rebuildClusters(db, source.id, nameIt, hashIt, phashIt);

  rebuildFts(db);

  return { usageCount, clusterCounts };
}
