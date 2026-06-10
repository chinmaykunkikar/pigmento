import { and, asc, count, desc, eq, inArray, like, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "../client";
import { assets } from "../schema";

export type GridSort =
  | "name-asc"
  | "name-desc"
  | "size-asc"
  | "size-desc"
  | "mtime-desc"
  | "mtime-asc";

function orderByFor(sort: GridSort): SQL[] {
  switch (sort) {
    case "name-asc":
      return [asc(assets.name)];
    case "name-desc":
      return [desc(assets.name)];
    case "size-asc":
      return [asc(assets.size), asc(assets.name)];
    case "size-desc":
      return [desc(assets.size), asc(assets.name)];
    case "mtime-desc":
      return [desc(assets.mtime), asc(assets.name)];
    case "mtime-asc":
      return [asc(assets.mtime), asc(assets.name)];
  }
}

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

export function listByFolder(
  db: Db,
  sourceId: number,
  dir: string,
  sort: GridSort = "name-asc",
  limit = 2000,
): AssetSummary[] {
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
    .orderBy(...orderByFor(sort))
    .limit(limit)
    .all();
}

export type AssetFilters = {
  sourceId: number;
  path?: string;
  q?: string;
  exts?: string[];
  unusedOnly?: boolean;
  sort?: GridSort;
  limit?: number;
};

function pushLikeMatch(conds: SQL<unknown>[], q: string) {
  const combined = or(like(assets.stem, `%${q}%`), like(assets.relPath, `%${q}%`));
  if (combined) conds.push(combined);
}

function ftsQuery(q: string): string {
  const tokens = q
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return "";
  return tokens.map((t) => `${t}*`).join(" ");
}

export function searchAssets(db: Db, f: AssetFilters): AssetSummary[] {
  const conds: SQL<unknown>[] = [eq(assets.sourceId, f.sourceId)];
  if (f.path !== undefined) conds.push(eq(assets.dir, f.path));
  if (f.exts && f.exts.length > 0) conds.push(inArray(assets.ext, f.exts));

  const q = f.q?.trim() ?? "";
  let matchedIds: number[] | null = null;
  if (q.length >= 2) {
    const fts = ftsQuery(q);
    if (fts) {
      const rows = db.all<{ id: number }>(
        sql`SELECT rowid AS id FROM assets_fts WHERE assets_fts MATCH ${fts} ORDER BY bm25(assets_fts) LIMIT 2000`,
      );
      matchedIds = rows.map((r) => r.id);
      if (matchedIds.length === 0) return [];
      conds.push(inArray(assets.id, matchedIds));
    } else {
      pushLikeMatch(conds, q);
    }
  } else if (q.length === 1) {
    pushLikeMatch(conds, q);
  }

  if (f.unusedOnly) {
    conds.push(sql`${assets.id} IN (SELECT asset_id FROM v_asset_usage WHERE usage_count = 0)`);
  }

  const hasExplicitSort = f.sort !== undefined;
  const orderBy = f.sort !== undefined ? orderByFor(f.sort) : [asc(assets.dir), asc(assets.name)];

  const rows = db
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
    .where(and(...conds))
    .orderBy(...orderBy)
    .limit(f.limit ?? 2000)
    .all();

  if (!hasExplicitSort && matchedIds && matchedIds.length > 0 && q.length >= 2) {
    const rank = new Map<number, number>(matchedIds.map((id, i) => [id, i]));
    return [...rows].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  }

  return rows;
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
