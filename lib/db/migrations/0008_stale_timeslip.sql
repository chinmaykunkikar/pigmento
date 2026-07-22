ALTER TABLE `style_usages` ADD `axis` text;--> statement-breakpoint
CREATE INDEX `style_usages_axis_idx` ON `style_usages` (`source_id`,`kind`,`axis`);