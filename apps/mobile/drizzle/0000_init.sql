CREATE TABLE `body_measurements` (
	`date` text PRIMARY KEY NOT NULL,
	`waist_cm` real,
	`hip_cm` real,
	`chest_cm` real,
	`arm_cm` real,
	`thigh_cm` real
);
--> statement-breakpoint
CREATE TABLE `check_ins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`result_json` text NOT NULL,
	`accepted` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `check_ins_date_idx` ON `check_ins` (`date`);--> statement-breakpoint
CREATE TABLE `diary_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`meal_type_id` integer NOT NULL,
	`food_id` text,
	`recipe_id` text,
	`name` text NOT NULL,
	`brand` text,
	`grams` real,
	`amount_label` text,
	`kcal` real NOT NULL,
	`protein` real NOT NULL,
	`carbs` real NOT NULL,
	`fat` real NOT NULL,
	`fiber` real,
	`sugar` real,
	`saturated_fat` real,
	`salt` real,
	`source` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`meal_type_id`) REFERENCES `meal_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `diary_date_idx` ON `diary_entries` (`date`);--> statement-breakpoint
CREATE INDEX `diary_food_idx` ON `diary_entries` (`food_id`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`food_id` text PRIMARY KEY NOT NULL,
	`food_json` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`barcode` text,
	`name` text NOT NULL,
	`name_alt` text,
	`brand` text,
	`image_url` text,
	`is_liquid` integer DEFAULT false NOT NULL,
	`kcal` real NOT NULL,
	`protein` real NOT NULL,
	`carbs` real NOT NULL,
	`fat` real NOT NULL,
	`fiber` real,
	`sugar` real,
	`saturated_fat` real,
	`salt` real,
	`micros_json` text,
	`portions_json` text DEFAULT '[]' NOT NULL,
	`nutri_score` text,
	`ingredients` text,
	`allergens_json` text DEFAULT '[]' NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `foods_barcode_idx` ON `foods` (`barcode`);--> statement-breakpoint
CREATE INDEX `foods_name_idx` ON `foods` (`name`);--> statement-breakpoint
CREATE TABLE `goals_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`valid_from` text NOT NULL,
	`kcal` real NOT NULL,
	`protein` real NOT NULL,
	`carbs` real NOT NULL,
	`fat` real NOT NULL,
	`water_ml` real NOT NULL,
	`steps` integer,
	`tdee` real NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `goals_valid_from_idx` ON `goals_history` (`valid_from`);--> statement-breakpoint
CREATE TABLE `meal_template_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` text NOT NULL,
	`food_id` text,
	`name` text NOT NULL,
	`brand` text,
	`grams` real,
	`amount_label` text,
	`kcal` real NOT NULL,
	`protein` real NOT NULL,
	`carbs` real NOT NULL,
	`fat` real NOT NULL,
	`fiber` real,
	`sugar` real,
	`saturated_fat` real,
	`salt` real,
	FOREIGN KEY (`template_id`) REFERENCES `meal_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meal_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meal_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text,
	`name` text,
	`sort` integer NOT NULL,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`sex` text NOT NULL,
	`birth_date` text NOT NULL,
	`height_cm` real NOT NULL,
	`body_fat_pct` real,
	`activity` text NOT NULL,
	`training_days_per_week` integer NOT NULL,
	`experience` text,
	`goal` text NOT NULL,
	`target_weight_kg` real,
	`pace` text NOT NULL,
	`diet` text NOT NULL,
	`allergies_json` text DEFAULT '[]' NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `progress_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`uri` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipe_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` text NOT NULL,
	`food_id` text NOT NULL,
	`name` text NOT NULL,
	`grams` real NOT NULL,
	`kcal` real NOT NULL,
	`protein` real NOT NULL,
	`carbs` real NOT NULL,
	`fat` real NOT NULL,
	`fiber` real,
	`sugar` real,
	`saturated_fat` real,
	`salt` real,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`servings` real DEFAULT 1 NOT NULL,
	`total_grams` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `water_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`ml` real NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `water_date_idx` ON `water_logs` (`date`);--> statement-breakpoint
CREATE TABLE `weights` (
	`date` text PRIMARY KEY NOT NULL,
	`kg` real NOT NULL
);
