import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { clusterMembers, clusters } from "../db/schema";
import type { HashCluster } from "./cluster-hash";
import type { NameCluster } from "./cluster-name";
import type { PhashCluster } from "./cluster-phash";

export type ClusterCounts = { name: number; hash: number; phash: number };

export function rebuildClusters(
  db: Db,
  sourceId: number,
  name: NameCluster[],
  hash: HashCluster[],
  phash: PhashCluster[],
): ClusterCounts {
  db.delete(clusters).where(eq(clusters.sourceId, sourceId)).run();

  db.transaction((tx) => {
    for (const c of name) {
      const [row] = tx
        .insert(clusters)
        .values({ sourceId, kind: "name", key: c.key, size: c.memberIds.length })
        .returning()
        .all();
      if (!row) continue;
      for (const aid of c.memberIds) {
        tx.insert(clusterMembers)
          .values({
            clusterId: row.id,
            assetId: aid,
            role: aid === c.canonicalId ? "canonical" : "member",
          })
          .run();
      }
    }

    for (const c of hash) {
      const [row] = tx
        .insert(clusters)
        .values({ sourceId, kind: "hash", key: c.key, size: c.memberIds.length })
        .returning()
        .all();
      if (!row) continue;
      for (const aid of c.memberIds) {
        tx.insert(clusterMembers)
          .values({
            clusterId: row.id,
            assetId: aid,
            role: aid === c.canonicalId ? "canonical" : "member",
          })
          .run();
      }
    }

    for (const c of phash) {
      const [row] = tx
        .insert(clusters)
        .values({ sourceId, kind: "phash", key: c.key, size: c.members.length })
        .returning()
        .all();
      if (!row) continue;
      for (const m of c.members) {
        tx.insert(clusterMembers)
          .values({
            clusterId: row.id,
            assetId: m.id,
            role: m.id === c.canonicalId ? "canonical" : "member",
            hamming: m.hamming,
          })
          .run();
      }
    }
  });

  return { name: name.length, hash: hash.length, phash: phash.length };
}
