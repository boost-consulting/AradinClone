import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, pgEnum, serial, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles
export const userRoleEnum = pgEnum('user_role', ['warehouse', 'store', 'admin']);

// Inventory states - Japanese terminology as specified
export const inventoryStateEnum = pgEnum('inventory_state', ['通常', '確保', '検品中', '不良']);

// Operation types for history
export const operationTypeEnum = pgEnum('operation_type', [
  '販売', '顧客返品', '出荷指示作成', '在庫確保', '出荷確定', 
  '仕入受入', '仕入受入・予定対応', '棚入れ', '店舗返品送付', '返品受入', '返品検品'
]);

// Location types
export const locationTypeEnum = pgEnum('location_type', ['warehouse', 'store']);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default('store'),
  storeId: integer("store_id").references(() => locations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Locations (warehouse shelves + stores)
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: locationTypeEnum("type").notNull(),
  code: text("code").notNull().unique(), // Location code for uniqueness
  displayOrder: integer("display_order").default(0),
  isActive: integer("is_active").default(1).notNull(),
});

// Products/SKUs
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  modelName: text("model_name").notNull(),
  color: text("color").notNull(),
  size: text("size").notNull(),
  category: text("category"),
  retailPrice: decimal("retail_price", { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  isActive: integer("is_active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Inventory balances (SKU × Location × State)
export const inventoryBalances = pgTable("inventory_balances", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  locationId: integer("location_id").references(() => locations.id).notNull(),
  state: inventoryStateEnum("state").notNull(),
  quantity: integer("quantity").default(0).notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
}, (table) => ({
  productLocationStateUnique: unique().on(table.productId, table.locationId, table.state),
}));

// Replenishment criteria (SKU × Location)
export const replenishmentCriteria = pgTable("replenishment_criteria", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  locationId: integer("location_id").references(() => locations.id).notNull(),
  minStock: integer("min_stock").default(0).notNull(),
  targetStock: integer("target_stock").default(0).notNull(),
  standardReplenishment: integer("standard_replenishment").default(0).notNull(),
}, (table) => ({
  productLocationUnique: unique().on(table.productId, table.locationId),
}));

// Shipping instructions
export const shippingInstructions = pgTable("shipping_instructions", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  fromLocationId: integer("from_location_id").references(() => locations.id).notNull(),
  toLocationId: integer("to_location_id").references(() => locations.id).notNull(),
  quantity: integer("quantity").notNull(),
  requestedDate: timestamp("requested_date"),
  status: text("status").default('pending').notNull(), // pending, confirmed, completed
  memo: text("memo"),
  createdBy: text("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Inbound plans
export const inboundPlans = pgTable("inbound_plans", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  supplierName: text("supplier_name").notNull(),
  plannedQty: integer("planned_qty").notNull(),
  receivedQty: integer("received_qty").default(0).notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").default('pending').notNull(), // pending, completed, canceled
  memo: text("memo"),
  createdBy: text("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// History/Audit trail - append only
export const inventoryHistory = pgTable("inventory_history", {
  id: serial("id").primaryKey(),
  operationType: operationTypeEnum("operation_type").notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(), // can be negative for reductions
  fromLocationId: integer("from_location_id").references(() => locations.id),
  toLocationId: integer("to_location_id").references(() => locations.id),
  fromState: inventoryStateEnum("from_state"),
  toState: inventoryStateEnum("to_state"),
  saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }),
  referenceId: text("reference_id"), // links to shipping instructions, etc.
  memo: text("memo"),
  performedBy: text("performed_by").references(() => users.id).notNull(),
  performedAt: timestamp("performed_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  store: one(locations, {
    fields: [users.storeId],
    references: [locations.id],
  }),
  historyEntries: many(inventoryHistory),
  shippingInstructions: many(shippingInstructions),
  inboundPlans: many(inboundPlans),
}));

export const locationsRelations = relations(locations, ({ many }) => ({
  inventoryBalances: many(inventoryBalances),
  replenishmentCriteria: many(replenishmentCriteria),
  shippingInstructionsFrom: many(shippingInstructions),
  shippingInstructionsTo: many(shippingInstructions),
  historyEntriesFrom: many(inventoryHistory),
  historyEntriesTo: many(inventoryHistory),
  users: many(users),
}));

export const productsRelations = relations(products, ({ many }) => ({
  inventoryBalances: many(inventoryBalances),
  replenishmentCriteria: many(replenishmentCriteria),
  shippingInstructions: many(shippingInstructions),
  inboundPlans: many(inboundPlans),
  historyEntries: many(inventoryHistory),
}));

export const inventoryBalancesRelations = relations(inventoryBalances, ({ one }) => ({
  product: one(products, {
    fields: [inventoryBalances.productId],
    references: [products.id],
  }),
  location: one(locations, {
    fields: [inventoryBalances.locationId],
    references: [locations.id],
  }),
}));

export const replenishmentCriteriaRelations = relations(replenishmentCriteria, ({ one }) => ({
  product: one(products, {
    fields: [replenishmentCriteria.productId],
    references: [products.id],
  }),
  location: one(locations, {
    fields: [replenishmentCriteria.locationId],
    references: [locations.id],
  }),
}));

export const shippingInstructionsRelations = relations(shippingInstructions, ({ one }) => ({
  product: one(products, {
    fields: [shippingInstructions.productId],
    references: [products.id],
  }),
  fromLocation: one(locations, {
    fields: [shippingInstructions.fromLocationId],
    references: [locations.id],
  }),
  toLocation: one(locations, {
    fields: [shippingInstructions.toLocationId],
    references: [locations.id],
  }),
  creator: one(users, {
    fields: [shippingInstructions.createdBy],
    references: [users.id],
  }),
}));

export const inboundPlansRelations = relations(inboundPlans, ({ one }) => ({
  product: one(products, {
    fields: [inboundPlans.productId],
    references: [products.id],
  }),
  creator: one(users, {
    fields: [inboundPlans.createdBy],
    references: [users.id],
  }),
}));

export const inventoryHistoryRelations = relations(inventoryHistory, ({ one }) => ({
  product: one(products, {
    fields: [inventoryHistory.productId],
    references: [products.id],
  }),
  fromLocation: one(locations, {
    fields: [inventoryHistory.fromLocationId],
    references: [locations.id],
  }),
  toLocation: one(locations, {
    fields: [inventoryHistory.toLocationId],
    references: [locations.id],
  }),
  performer: one(users, {
    fields: [inventoryHistory.performedBy],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertInventoryBalanceSchema = createInsertSchema(inventoryBalances).omit({
  id: true,
  lastUpdated: true,
});

export const insertReplenishmentCriteriaSchema = createInsertSchema(replenishmentCriteria).omit({
  id: true,
});

export const insertShippingInstructionSchema = createInsertSchema(shippingInstructions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
}).extend({
  // Accept flexible date formats and coerce to proper types
  requestedDate: z.union([
    z.string().datetime({ offset: true }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.date()
  ]).optional().nullable().transform((val) => {
    if (!val) return null;
    if (typeof val === 'string') {
      return new Date(val);
    }
    return val;
  }),
  // Coerce numeric fields
  productId: z.coerce.number().int().positive(),
  fromLocationId: z.coerce.number().int().positive(),
  toLocationId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
});

export const insertInboundPlanSchema = createInsertSchema(inboundPlans).omit({
  id: true,
  createdAt: true,
}).extend({
  // Accept flexible date formats and coerce to proper types
  dueDate: z.union([
    z.string().datetime({ offset: true }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.date()
  ]).transform((val) => {
    if (typeof val === 'string') {
      return new Date(val);
    }
    return val;
  }),
  // Coerce numeric fields
  productId: z.coerce.number().int().positive(),
  plannedQty: z.coerce.number().int().positive(),
  receivedQty: z.coerce.number().int().min(0).default(0),
});

export const insertInventoryHistorySchema = createInsertSchema(inventoryHistory).omit({
  id: true,
  performedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InventoryBalance = typeof inventoryBalances.$inferSelect;
export type InsertInventoryBalance = z.infer<typeof insertInventoryBalanceSchema>;
export type ReplenishmentCriteria = typeof replenishmentCriteria.$inferSelect;
export type InsertReplenishmentCriteria = z.infer<typeof insertReplenishmentCriteriaSchema>;
export type ShippingInstruction = typeof shippingInstructions.$inferSelect;
export type InsertShippingInstruction = z.infer<typeof insertShippingInstructionSchema>;
export type InboundPlan = typeof inboundPlans.$inferSelect;
export type InsertInboundPlan = z.infer<typeof insertInboundPlanSchema>;
export type InventoryHistory = typeof inventoryHistory.$inferSelect;
export type InsertInventoryHistory = z.infer<typeof insertInventoryHistorySchema>;

// Utility types
export type InventoryState = '通常' | '確保' | '検品中' | '不良';
export type UserRole = 'warehouse' | 'store' | 'admin';
export type OperationType = '販売' | '顧客返品' | '出荷指示作成' | '在庫確保' | '出荷確定' | 
  '仕入受入' | '仕入受入・予定対応' | '棚入れ' | '店舗返品送付' | '返品受入' | '返品検品';
