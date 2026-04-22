import { and, asc, count, eq, sql } from "drizzle-orm";
import type { Db } from "../client";
import { assets } from "../schema";

export type TreeNode = {
  name: string;
  path: string;
  count: number;
  children: TreeNode[];
};

export type AssetSummary = {
  id: number;
  name: string;
  ext: string;
  size: number;
  width: number | null;
  height: number | null;
  category: string;
};

export function folderDistribution(db: Db, sourceId: number): { dir: string; count: number }[] {
  return db
    .select({ dir: assets.dir, count: count() })
    .from(assets)
    .where(eq(assets.sourceId, sourceId))
    .groupBy(assets.dir)
    .all();
}

export function buildTree(rows: { dir: string; count: number }[]): TreeNode {
  const root: TreeNode = { name: "", path: "", count: 0, children: [] };
  const map = new Map<string, TreeNode>([["", root]]);

  for (const { dir, count: n } of rows) {
    root.count += n;
    const parts = dir ? dir.split("/").filter(Boolean) : [];
    let parent = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      if (!name) continue;
      const path = parts.slice(0, i + 1).join("/");
      let node = map.get(path);
      if (!node) {
        node = { name, path, count: 0, children: [] };
        map.set(path, node);
        parent.children.push(node);
      }
      node.count += n;
      parent = node;
    }
  }

  sortTree(root);
  return root;
}

function sortTree(node: TreeNode): void {
  node.children.sort((a, b) => a.name.localeCompare(b.name));
  for (const c of node.children) sortTree(c);
}

export function listByFolder(db: Db, sourceId: number, dir: string, limit = 2000): AssetSummary[] {
  return db
    .select({
      id: assets.id,
      name: assets.name,
      ext: assets.ext,
      size: assets.size,
      width: assets.width,
      height: assets.height,
      category: assets.category,
    })
    .from(assets)
    .where(and(eq(assets.sourceId, sourceId), eq(assets.dir, dir)))
    .orderBy(asc(assets.name))
    .limit(limit)
    .all();
}

export function listBySource(db: Db, sourceId: number, limit = 10000): AssetSummary[] {
  return db
    .select({
      id: assets.id,
      name: assets.name,
      ext: assets.ext,
      size: assets.size,
      width: assets.width,
      height: assets.height,
      category: assets.category,
    })
    .from(assets)
    .where(eq(assets.sourceId, sourceId))
    .orderBy(asc(assets.dir), asc(assets.name))
    .limit(limit)
    .all();
}

export function findAssetById(db: Db, id: number) {
  const [row] = db.select().from(assets).where(eq(assets.id, id)).all();
  return row;
}

export function totalSizeBySource(db: Db, sourceId: number): number {
  const [row] = db
    .select({ total: sql<number>`COALESCE(SUM(${assets.size}), 0)` })
    .from(assets)
    .where(eq(assets.sourceId, sourceId))
    .all();
  return Number(row?.total ?? 0);
}
