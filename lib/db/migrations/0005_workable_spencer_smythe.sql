CREATE TABLE `dispatch_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` integer NOT NULL,
	`plan_id` text NOT NULL,
	`harness` text NOT NULL,
	`mode` text NOT NULL,
	`pid` integer,
	`pid_started_at_ms` integer,
	`token` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dispatch_jobs_source_idx` ON `dispatch_jobs` (`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dispatch_jobs_active_uq` ON `dispatch_jobs` (`source_id`) WHERE status IN ('pending', 'running');--> statement-breakpoint
CREATE TABLE `index_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`pid` integer NOT NULL,
	`pid_started_at_ms` integer NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `index_runs_source_idx` ON `index_runs` (`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `index_runs_active_uq` ON `index_runs` (`source_id`) WHERE status = 'running';--> statement-breakpoint
ALTER TABLE `assets` ADD `phash_popcount` integer;--> statement-breakpoint
ALTER TABLE `assets` ADD `raster_white_fraction` real;--> statement-breakpoint
ALTER TABLE `assets` ADD `embed_status` text;