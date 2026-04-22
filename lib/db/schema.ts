import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sources = sqliteTable(
  "sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    root: text("root").notNull(),
    label: text("label").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastIndexedAt: text("last_indexed_at"),
  },
  (t) => [uniqueIndex("sources_root_uq").on(t.root)],
);

export const assets = sqliteTable(
  "assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    absPath: text("abs_path").notNull(),
    relPath: text("rel_path").notNull(),
    dir: text("dir").notNull(),
    name: text("name").notNull(),
    stem: text("stem").notNull(),
    ext: text("ext").notNull(),
    size: integer("size").notNull(),
    mtime: integer("mtime").notNull(),
    contentHash: text("content_hash").notNull(),
    sha1: text("sha1").notNull(),
    width: integer("width"),
    height: integer("height"),
    category: text("category").notNull(),
    phash: text("phash"),
    viewBox: text("view_box"),
    pathsCount: integer("paths_count"),
    commandsCount: integer("commands_count"),
    hasFill: integer("has_fill", { mode: "boolean" }),
    strokeWidths: text("stroke_widths"),
    literalColors: text("literal_colors"),
    dominantColor: text("dominant_color"),
    author: text("author"),
  },
  (t) => [
    uniqueIndex("assets_abs_uq").on(t.absPath),
    index("assets_source_idx").on(t.sourceId),
    index("assets_dir_idx").on(t.sourceId, t.dir),
    index("assets_stem_idx").on(t.stem),
    index("assets_hash_idx").on(t.contentHash),
    index("assets_ext_idx").on(t.ext),
    index("assets_phash_idx").on(t.ext, t.phash),
  ],
);

export const usages = sqliteTable(
  "usages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    relPath: text("rel_path").notNull(),
    line: integer("line").notNull(),
    snippet: text("snippet").notNull(),
  },
  (t) => [index("usages_asset_idx").on(t.assetId), index("usages_source_idx").on(t.sourceId)],
);

export const clusters = sqliteTable(
  "clusters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    key: text("key").notNull(),
    size: integer("size").notNull(),
  },
  (t) => [
    uniqueIndex("clusters_source_kind_key_uq").on(t.sourceId, t.kind, t.key),
    index("clusters_source_kind_idx").on(t.sourceId, t.kind),
  ],
);

export const clusterMembers = sqliteTable(
  "cluster_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clusterId: integer("cluster_id")
      .notNull()
      .references(() => clusters.id, { onDelete: "cascade" }),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    hamming: integer("hamming"),
  },
  (t) => [
    index("cluster_members_cluster_idx").on(t.clusterId),
    index("cluster_members_asset_idx").on(t.assetId),
  ],
);

export const sourcesRelations = relations(sources, ({ many }) => ({
  assets: many(assets),
  clusters: many(clusters),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  source: one(sources, {
    fields: [assets.sourceId],
    references: [sources.id],
  }),
  usages: many(usages),
  clusterMemberships: many(clusterMembers),
}));

export const usagesRelations = relations(usages, ({ one }) => ({
  asset: one(assets, { fields: [usages.assetId], references: [assets.id] }),
  source: one(sources, { fields: [usages.sourceId], references: [sources.id] }),
}));

export const clustersRelations = relations(clusters, ({ one, many }) => ({
  source: one(sources, { fields: [clusters.sourceId], references: [sources.id] }),
  members: many(clusterMembers),
}));

export const clusterMembersRelations = relations(clusterMembers, ({ one }) => ({
  cluster: one(clusters, { fields: [clusterMembers.clusterId], references: [clusters.id] }),
  asset: one(assets, { fields: [clusterMembers.assetId], references: [assets.id] }),
}));

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Usage = typeof usages.$inferSelect;
export type NewUsage = typeof usages.$inferInsert;
export type Cluster = typeof clusters.$inferSelect;
export type NewCluster = typeof clusters.$inferInsert;
export type ClusterMember = typeof clusterMembers.$inferSelect;
export type NewClusterMember = typeof clusterMembers.$inferInsert;
