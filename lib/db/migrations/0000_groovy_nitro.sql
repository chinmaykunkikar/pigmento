CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`abs_path` text NOT NULL,
	`rel_path` text NOT NULL,
	`dir` text NOT NULL,
	`name` text NOT NULL,
	`stem` text NOT NULL,
	`ext` text NOT NULL,
	`size` integer NOT NULL,
	`mtime` integer NOT NULL,
	`content_hash` text NOT NULL,
	`sha1` text NOT NULL,
	`width` integer,
	`height` integer,
	`category` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_abs_uq` ON `assets` (`abs_path`);--> statement-breakpoint
CREATE INDEX `assets_source_idx` ON `assets` (`source_id`);--> statement-breakpoint
CREATE INDEX `assets_dir_idx` ON `assets` (`source_id`,`dir`);--> statement-breakpoint
CREATE INDEX `assets_stem_idx` ON `assets` (`stem`);--> statement-breakpoint
CREATE INDEX `assets_hash_idx` ON `assets` (`content_hash`);--> statement-breakpoint
CREATE INDEX `assets_ext_idx` ON `assets` (`ext`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`root` text NOT NULL,
	`label` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_root_uq` ON `sources` (`root`);