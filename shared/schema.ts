import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  systemType: text("system_type").notNull(),
});

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  upc: text("upc").notNull(),
  venCode: text("ven_code"),
  description: text("description").notNull(),
  size: text("size"),
  wh2qty: integer("wh2qty").default(0),
  rvsbondqty: integer("rvsbondqty").default(0),
  sdeptName: text("sdept_name"),
  vendorId: text("vendor_id"),
  storeQty: integer("store_qty").default(0),
  hostQty: integer("host_qty").default(0),
  cost: text("cost"),
  price: text("price"),
  grossMargin: text("gross_margin"),
  systemType: text("system_type").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const containerItems = pgTable("container_items", {
  id: serial("id").primaryKey(),
  container: text("container").notNull(),
  supplier: text("supplier"),
  upc: text("upc").notNull(),
  description: text("description").notNull(),
  itemNumber: text("item_number"),
  receivingDate: text("receiving_date").notNull(),
  batchNumber: text("batch_number").notNull(),
  qtyReceived: integer("qty_received").notNull(),
  expiryDate: text("expiry_date").notNull(),
  systemType: text("system_type").notNull(),
  remainingQty: integer("remaining_qty"),
  status: text("status").default("good"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const stockDeductions = pgTable("stock_deductions", {
  id: serial("id").primaryKey(),
  upc: text("upc").notNull(),
  description: text("description").notNull(),
  qtyDeducted: integer("qty_deducted").notNull(),
  batchNumber: text("batch_number").notNull(),
  expiryDate: text("expiry_date").notNull(),
  deductionDate: timestamp("deduction_date").defaultNow(),
  fefoApplied: boolean("fefo_applied").default(true),
  systemType: text("system_type").notNull(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // warning, alert, success, info
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  timestamp: timestamp("timestamp").defaultNow(),
  systemType: text("system_type").notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  systemType: true,
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  lastUpdated: true,
});

export const insertContainerItemSchema = createInsertSchema(containerItems).omit({
  id: true,
  lastUpdated: true,
});

export const insertStockDeductionSchema = createInsertSchema(stockDeductions).omit({
  id: true,
  deductionDate: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  timestamp: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;

export type InsertContainerItem = z.infer<typeof insertContainerItemSchema>;
export type ContainerItem = typeof containerItems.$inferSelect;

export type InsertStockDeduction = z.infer<typeof insertStockDeductionSchema>;
export type StockDeduction = typeof stockDeductions.$inferSelect;

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

// Expiry status types
export type ExpiryStatus = "expired" | "expiring-soon" | "good" | "short-dated";
