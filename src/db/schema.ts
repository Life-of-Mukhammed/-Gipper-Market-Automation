import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
  date,
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
    clientId: uuid("client_id").references(() => clients.id),
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
      "payable_payment",
      "adjustment",
      "shift_open",
      "shift_close",
    ],
  }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  category: text("category"),
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
  relatedReceivingId: uuid("related_receiving_id").references(
    () => receivingDocuments.id,
  ),
  note: text("note"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---- Клиенты / Долги (Phase 2) ----

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  telegramChatId: text("telegram_chat_id").unique(),
  address: text("address"),
  notes: text("notes"),
  passportNumber: text("passport_number"),
  inn: text("inn"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const debts = pgTable("debts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  saleId: uuid("sale_id").references(() => sales.id),
  originalAmount: numeric("original_amount", { precision: 14, scale: 2 }).notNull(),
  remainingBalance: numeric("remaining_balance", { precision: 14, scale: 2 }).notNull(),
  markupAmount: numeric("markup_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  markupPercent: numeric("markup_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  status: text("status", { enum: ["open", "paid", "overdue"] })
    .notNull()
    .default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentSchedules = pgTable("payment_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  debtId: uuid("debt_id")
    .notNull()
    .references(() => debts.id),
  installmentNumber: integer("installment_number").notNull(),
  dueDate: date("due_date").notNull(),
  amountDue: numeric("amount_due", { precision: 14, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).notNull().default("0"),
  status: text("status", { enum: ["pending", "paid", "overdue"] })
    .notNull()
    .default("pending"),
  reminderSentAt: timestamp("reminder_sent_at"),
});

export const debtPayments = pgTable("debt_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  debtId: uuid("debt_id")
    .notNull()
    .references(() => debts.id),
  paymentScheduleId: uuid("payment_schedule_id").references(() => paymentSchedules.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  cashAccountId: uuid("cash_account_id")
    .notNull()
    .references(() => cashAccounts.id),
  cashierId: uuid("cashier_id")
    .notNull()
    .references(() => users.id),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
});

// Наши долги (payables) — money the store owes to suppliers/others,
// the mirror image of Долги (customer debts owed to the store).
export const payables = pgTable("payables", {
  id: uuid("id").primaryKey().defaultRandom(),
  creditorName: text("creditor_name").notNull(),
  phone: text("phone"),
  originalAmount: numeric("original_amount", { precision: 14, scale: 2 }).notNull(),
  remainingBalance: numeric("remaining_balance", { precision: 14, scale: 2 }).notNull(),
  dueDate: date("due_date"),
  note: text("note"),
  status: text("status", { enum: ["open", "paid"] })
    .notNull()
    .default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payablePayments = pgTable("payable_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  payableId: uuid("payable_id")
    .notNull()
    .references(() => payables.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  cashAccountId: uuid("cash_account_id")
    .notNull()
    .references(() => cashAccounts.id),
  cashierId: uuid("cashier_id")
    .notNull()
    .references(() => users.id),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
});

export const notificationJobs = pgTable("notification_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type", {
    enum: ["receipt", "payment_reminder", "overdue_notice"],
  }).notNull(),
  channel: text("channel", { enum: ["telegram", "whatsapp"] }).notNull(),
  targetClientId: uuid("target_client_id")
    .notNull()
    .references(() => clients.id),
  payloadRef: uuid("payload_ref").notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["pending", "sent", "failed"] })
    .notNull()
    .default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  scheduledFor: timestamp("scheduled_for").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---- Поступление / Поставщики (Phase 3) ----

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  contactInfo: text("contact_info"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const receivingDocuments = pgTable("receiving_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  status: text("status", { enum: ["draft", "confirmed"] })
    .notNull()
    .default("draft"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

export const receivingItems = pgTable("receiving_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  receivingDocumentId: uuid("receiving_document_id")
    .notNull()
    .references(() => receivingDocuments.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  qty: integer("qty").notNull(),
  unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull(),
});

// ---- Отчёт по кассе (Phase 3) ----

export const cashShifts = pgTable(
  "cash_shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cashAccountId: uuid("cash_account_id")
      .notNull()
      .references(() => cashAccounts.id),
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => users.id),
    openedAt: timestamp("opened_at").notNull().defaultNow(),
    closedAt: timestamp("closed_at"),
    openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).notNull(),
    closingBalanceExpected: numeric("closing_balance_expected", {
      precision: 14,
      scale: 2,
    }),
    closingBalanceActual: numeric("closing_balance_actual", {
      precision: 14,
      scale: 2,
    }),
    status: text("status", { enum: ["open", "closed"] })
      .notNull()
      .default("open"),
  },
  (table) => [
    uniqueIndex("cash_shifts_one_open_per_account")
      .on(table.cashAccountId)
      .where(sql`${table.status} = 'open'`),
  ],
);

// ---- Валюта / Реквизиты (Phase 4) ----

export const currencyRates = pgTable("currency_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  currencyCode: text("currency_code").notNull(),
  rateToBase: numeric("rate_to_base", { precision: 14, scale: 4 }).notNull(),
  effectiveDate: date("effective_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---- Активы (Phase 5) ----

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category"),
  purchaseDate: date("purchase_date"),
  value: numeric("value", { precision: 14, scale: 2 }).notNull().default("0"),
  note: text("note"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const companyRequisites = pgTable("company_requisites", {
  id: uuid("id").primaryKey().defaultRandom(),
  legalName: text("legal_name").notNull().default(""),
  taxId: text("tax_id").default(""),
  address: text("address").default(""),
  phone: text("phone").default(""),
  bankDetails: text("bank_details").default(""),
  receiptFooterText: text("receipt_footer_text").default(""),
});
