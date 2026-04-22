import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sources = sqliteTable(
  "sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    root: text("root").notNull(),
    label: text("label").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
  },
  (t) => [
    uniqueIndex("assets_abs_uq").on(t.absPath),
    index("assets_source_idx").on(t.sourceId),
    index("assets_dir_idx").on(t.sourceId, t.dir),
    index("assets_stem_idx").on(t.stem),
    index("assets_hash_idx").on(t.contentHash),
    index("assets_ext_idx").on(t.ext),
  ],
);

export const sourcesRelations = relations(sources, ({ many }) => ({
  assets: many(assets),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  source: one(sources, {
    fields: [assets.sourceId],
    references: [sources.id],
  }),
}));

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
