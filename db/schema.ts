import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetCode: text("asset_code").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  status: text("status", { enum: ["available", "pulled_out"] }).notNull().default("available"),
  currentEvent: text("current_event"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("assets_asset_code_unique").on(table.assetCode), index("assets_status_idx").on(table.status)]);

export const movements = sqliteTable("movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  action: text("action", { enum: ["pullout", "return"] }).notNull(),
  eventName: text("event_name").notNull().default(""),
  operatorName: text("operator_name").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("movements_asset_idx").on(table.assetId), index("movements_created_idx").on(table.createdAt)]);

export const staff = sqliteTable("staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: text("employee_id").notNull(),
  fullName: text("full_name").notNull(),
  position: text("position").notNull(),
  role: text("role").notNull(),
  contactNumber: text("contact_number").notNull().default(""),
  username: text("username").notNull(),
  accountStatus: text("account_status").notNull().default("active"),
  attendanceStatus: text("attendance_status").notNull().default("present"),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("staff_employee_id_unique").on(table.employeeId), uniqueIndex("staff_username_unique").on(table.username)]);

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientCode: text("client_code").notNull(),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  contact: text("contact").notNull().default(""),
  email: text("email").notNull().default(""),
  balance: integer("balance").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("clients_code_unique").on(table.clientCode)]);

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventCode: text("event_code").notNull(),
  title: text("title").notNull(),
  clientName: text("client_name").notNull(),
  venue: text("venue").notNull(),
  eventDate: text("event_date").notNull(),
  status: text("status").notNull().default("confirmed"),
  crewCount: integer("crew_count").notNull().default(0),
  equipmentCount: integer("equipment_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("events_code_unique").on(table.eventCode), index("events_date_idx").on(table.eventDate)]);

export const quotations = sqliteTable("quotations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quoteNo: text("quote_no").notNull(),
  clientName: text("client_name").notNull(),
  eventName: text("event_name").notNull(),
  amount: integer("amount").notNull().default(0),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("quotations_no_unique").on(table.quoteNo)]);

export const financeEntries = sqliteTable("finance_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  eventName: text("event_name").notNull().default(""),
  entryDate: text("entry_date").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("finance_date_idx").on(table.entryDate)]);

export const warehouseItems = sqliteTable("warehouse_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemCode: text("item_code").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(0),
  unit: text("unit").notNull().default("pcs"),
  supplier: text("supplier").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("warehouse_code_unique").on(table.itemCode)]);

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull().default("info"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  dueDate: text("due_date"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const maintenance = sqliteTable("maintenance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetCode: text("asset_code").notNull(),
  issue: text("issue").notNull(),
  status: text("status").notNull().default("scheduled"),
  dueDate: text("due_date").notNull(),
  technician: text("technician").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("maintenance_asset_idx").on(table.assetCode)]);

export const authCredentials = sqliteTable("auth_credentials", {
  staffId: integer("staff_id").primaryKey().references(() => staff.id),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  passwordUpdatedAt: text("password_updated_at"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
});

export const authSessions = sqliteTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("auth_sessions_staff_idx").on(table.staffId), index("auth_sessions_expiry_idx").on(table.expiresAt)]);
