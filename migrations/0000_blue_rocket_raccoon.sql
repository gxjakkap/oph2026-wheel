CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`weight` integer DEFAULT 1 NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`image` text,
	CONSTRAINT "items_stock_check" CHECK("items"."stock" >= 0),
	CONSTRAINT "items_weight_check" CHECK("items"."weight" >= 0)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `spins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`item_id` integer,
	`item_name` text NOT NULL,
	`voided` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE set null
);
