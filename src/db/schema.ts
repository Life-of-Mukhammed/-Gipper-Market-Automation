import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "cashier"] })
    .notNull()
    .default("cashier"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  skuCode: text("sku_code").notNull().unique(),
  barcode: text("barcode").unique(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("шт"),
  category: text("category"),
  purchasePrice: numeric("purchase_price", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  salePrice: numeric("sale_price", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  stockQty: integer("stock_qty").notNull().default(0),
  minStockThreshold: integer("min_stock_threshold").notNull().default(0),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
