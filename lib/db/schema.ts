import { relations, sql } from "drizzle-orm";
import {
  customType,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const float32Blob = customType<{ data: Float32Array; driverData: Buffer }>({
  dataType: () => "blob",
  toDriver: (v) => Buffer.from(v.buffer, v.byteOffset, v.byteLength),
  fromDriver: (b) => new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4),
});

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
    clipEmbedding: float32Blob("clip_embedding"),
    phashPopcount: integer("phash_popcount"),
    rasterWhiteFraction: real("raster_white_fraction"),
    embedStatus: text("embed_status", { enum: ["ok", "failed", "degenerate"] }),
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
    // relPath is display-only; absPath is authoritative for any file edit so
    // a path can never resolve against the wrong root
    relPath: text("rel_path").notNull(),
    absPath: text("abs_path").notNull().default(""),
    line: integer("line").notNull(),
    snippet: text("snippet").notNull(),
    commented: integer("commented", { mode: "boolean" }).notNull().default(false),
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

export const indexRuns = sqliteTable(
  "index_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    pid: integer("pid").notNull(),
    pidStartedAtMs: integer("pid_started_at_ms").notNull(),
    status: text("status", { enum: ["running", "done", "error", "crashed"] }).notNull(),
    error: text("error"),
    startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    endedAt: text("ended_at"),
  },
  (t) => [
    index("index_runs_source_idx").on(t.sourceId),
    uniqueIndex("index_runs_active_uq").on(t.sourceId).where(sql`status = 'running'`),
  ],
);

export const dispatchJobs = sqliteTable(
  "dispatch_jobs",
  {
    id: text("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull(),
    harness: text("harness").notNull(),
    mode: text("mode").notNull(),
    pid: integer("pid"),
    pidStartedAtMs: integer("pid_started_at_ms"),
    token: text("token").notNull(),
    status: text("status", {
      enum: ["pending", "running", "done", "failed", "cancelled", "orphaned", "crashed"],
    }).notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    endedAt: text("ended_at"),
  },
  (t) => [
    index("dispatch_jobs_source_idx").on(t.sourceId),
    uniqueIndex("dispatch_jobs_active_uq")
      .on(t.sourceId)
      .where(sql`status IN ('pending', 'running')`),
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
export type IndexRun = typeof indexRuns.$inferSelect;
export type NewIndexRun = typeof indexRuns.$inferInsert;
export type DispatchJobRow = typeof dispatchJobs.$inferSelect;
export type NewDispatchJobRow = typeof dispatchJobs.$inferInsert;
