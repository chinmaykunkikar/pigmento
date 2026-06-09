ALTER TABLE `usages` ADD `abs_path` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `usages` SET `abs_path` = CASE WHEN `rel_path` LIKE '/%' THEN `rel_path` ELSE (SELECT s.`root` FROM `sources` s WHERE s.`id` = `usages`.`source_id`) || '/' || `rel_path` END WHERE `abs_path` = '';
