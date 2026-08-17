import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
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

export const cashAccounts = pgTable("cash_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  currency: text("currency").notNull().default("UZS"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientUuid: text("client_uuid").notNull().unique(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => users.id),
    status: text("status", {
      enum: ["completed", "refunded", "voided"],
    })
      .notNull()
      .default("completed"),
    paymentType: text("payment_type", {
      enum: ["cash", "card", "debt"],
    }).notNull(),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    syncStatus: text("sync_status", { enum: ["local", "synced"] })
      .notNull()
      .default("synced"),
    hadStockConflict: boolean("had_stock_conflict").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("sales_client_uuid_idx").on(table.clientUuid)],
);

export const saleItems = pgTable("sale_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => sales.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  qty: integer("qty").notNull(),
  unitPriceAtSale: numeric("unit_price_at_sale", {
    precision: 14,
    scale: 2,
  }).notNull(),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
});

export const cashTransactions = pgTable("cash_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  cashAccountId: uuid("cash_account_id")
    .notNull()
    .references(() => cashAccounts.id),
  type: text("type", {
    enum: [
      "sale_income",
      "payout",
      "debt_payment",
      "adjustment",
      "shift_open",
      "shift_close",
    ],
  }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  relatedSaleId: uuid("related_sale_id").references(() => sales.id),
  cashierId: uuid("cashier_id")
    .notNull()
    .references(() => users.id),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  type: text("type", {
    enum: ["sale", "receiving", "adjustment", "writeoff"],
  }).notNull(),
  qtyDelta: integer("qty_delta").notNull(),
  relatedSaleId: uuid("related_sale_id").references(() => sales.id),
  note: text("note"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
