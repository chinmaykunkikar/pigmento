CREATE TABLE `style_cluster_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cluster_id` integer NOT NULL,
	`color` text NOT NULL,
	`role` text NOT NULL,
	`delta_e` real,
	`usage_count` integer NOT NULL,
	FOREIGN KEY (`cluster_id`) REFERENCES `style_clusters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `style_cluster_members_cluster_idx` ON `style_cluster_members` (`cluster_id`);--> statement-breakpoint
CREATE TABLE `style_clusters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`canonical` text NOT NULL,
	`size` integer NOT NULL,
	`neutral` integer DEFAULT false NOT NULL,
	`max_delta_e` real,
	`params` text,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `style_clusters_source_kind_key_uq` ON `style_clusters` (`source_id`,`kind`,`key`);--> statement-breakpoint
CREATE INDEX `style_clusters_source_kind_idx` ON `style_clusters` (`source_id`,`kind`);--> statement-breakpoint
CREATE TABLE `style_usages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`kind` text NOT NULL,
	`normalized_color` text,
	`alpha` real,
	`raw_token` text NOT NULL,
	`rel_path` text NOT NULL,
	`abs_path` text DEFAULT '' NOT NULL,
	`line` integer,
	`col` integer,
	`start_offset` integer,
	`end_offset` integer,
	`snippet` text,
	`context_kind` text NOT NULL,
	`context_detail` text,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `style_usages_source_kind_idx` ON `style_usages` (`source_id`,`kind`);--> statement-breakpoint
CREATE INDEX `style_usages_norm_idx` ON `style_usages` (`source_id`,`kind`,`normalized_color`);