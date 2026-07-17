CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_code` text NOT NULL,
	`name` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_code_unique` ON `clients` (`client_code`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_code` text NOT NULL,
	`title` text NOT NULL,
	`client_name` text NOT NULL,
	`venue` text NOT NULL,
	`event_date` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`crew_count` integer DEFAULT 0 NOT NULL,
	`equipment_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_code_unique` ON `events` (`event_code`);--> statement-breakpoint
CREATE INDEX `events_date_idx` ON `events` (`event_date`);--> statement-breakpoint
CREATE TABLE `finance_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`event_name` text DEFAULT '' NOT NULL,
	`entry_date` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `finance_date_idx` ON `finance_entries` (`entry_date`);--> statement-breakpoint
CREATE TABLE `maintenance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_code` text NOT NULL,
	`issue` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`due_date` text NOT NULL,
	`technician` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `maintenance_asset_idx` ON `maintenance` (`asset_code`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`severity` text DEFAULT 'info' NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`due_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quote_no` text NOT NULL,
	`client_name` text NOT NULL,
	`event_name` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotations_no_unique` ON `quotations` (`quote_no`);--> statement-breakpoint
CREATE TABLE `staff` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` text NOT NULL,
	`full_name` text NOT NULL,
	`position` text NOT NULL,
	`role` text NOT NULL,
	`contact_number` text DEFAULT '' NOT NULL,
	`username` text NOT NULL,
	`account_status` text DEFAULT 'active' NOT NULL,
	`attendance_status` text DEFAULT 'present' NOT NULL,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_employee_id_unique` ON `staff` (`employee_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `staff_username_unique` ON `staff` (`username`);--> statement-breakpoint
CREATE TABLE `warehouse_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_code` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`min_stock` integer DEFAULT 0 NOT NULL,
	`unit` text DEFAULT 'pcs' NOT NULL,
	`supplier` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warehouse_code_unique` ON `warehouse_items` (`item_code`);