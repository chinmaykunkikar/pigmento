CREATE TABLE `cluster_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cluster_id` integer NOT NULL,
	`asset_id` integer NOT NULL,
	`role` text NOT NULL,
	`hamming` integer,
	FOREIGN KEY (`cluster_id`) REFERENCES `clusters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cluster_members_cluster_idx` ON `cluster_members` (`cluster_id`);--> statement-breakpoint
CREATE INDEX `cluster_members_asset_idx` ON `cluster_members` (`asset_id`);--> statement-breakpoint
CREATE TABLE `clusters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`size` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clusters_source_kind_key_uq` ON `clusters` (`source_id`,`kind`,`key`);--> statement-breakpoint
CREATE INDEX `clusters_source_kind_idx` ON `clusters` (`source_id`,`kind`);--> statement-breakpoint
CREATE TABLE `usages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`source_id` integer NOT NULL,
	`rel_path` text NOT NULL,
	`line` integer NOT NULL,
	`snippet` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `usages_asset_idx` ON `usages` (`asset_id`);--> statement-breakpoint
CREATE INDEX `usages_source_idx` ON `usages` (`source_id`);--> statement-breakpoint
ALTER TABLE `assets` ADD `phash` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `view_box` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `paths_count` integer;--> statement-breakpoint
ALTER TABLE `assets` ADD `commands_count` integer;--> statement-breakpoint
ALTER TABLE `assets` ADD `has_fill` integer;--> statement-breakpoint
ALTER TABLE `assets` ADD `stroke_widths` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `literal_colors` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `dominant_color` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `author` text;--> statement-breakpoint
CREATE INDEX `assets_phash_idx` ON `assets` (`ext`,`phash`);