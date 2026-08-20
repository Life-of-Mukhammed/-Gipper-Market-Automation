"use server";

import { and, asc, eq, gt, gte, inArray, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import {
  cashAccounts,
  cashTransactions,
  clients,
  companyRequisites,
  debts,
  paymentSchedules,
  products,
  saleItems,
  sales,
  stockMovements,
  warehouses,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { homoglyphContains } from "@/lib/search-sql";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import { enqueueWhatsappMessage } from "@/lib/notifications/queue";
import { buildSaleReceiptText, type ReceiptItem } from "@/lib/receipts/text";

export type CartItemInput = {
  productId: string;
  qty: number;
};

type CreateClientForPosResult =
  | { error: string; client?: undefined }
  | { error?: undefined; client: { id: string; fullName: string; phone: string } };

export async function createClientForPos(formData: FormData): Promise<CreateClientForPosResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Не авторизован" };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!fullName || !phone) {
    return { error: "Имя и телефон обязательны" };
  }

  const [client] = await db.insert(clients).values({ fullName, phone }).returning();
  revalidatePath("/klienty");
  return { client: { id: client.id, fullName: client.fullName, phone: client.phone } };
}

const POS_PRODUCT_COLUMNS = {
  id: products.id,
  skuCode: products.skuCode,
  barcode: products.barcode,
  name: products.name,
  unit: products.unit,
  category: products.category,
  purchasePrice: products.purchasePrice,
  salePrice: products.salePrice,
  stockQty: products.stockQty,
  minStockThreshold: products.minStockThreshold,
};

/**
 * Live search used while online — avoids ever loading the full catalog
 * just to type-ahead. Exact sku/barcode match (the common barcode-scanner
 * path) is checked first so a scan resolves in one indexed lookup instead
 * of a broader ilike scan.
 */
export async function searchProductsOnline(query: string) {
  const q = query.trim();
  if (!q) return [];

  const [exact] = await db
    .select(POS_PRODUCT_COLUMNS)
    .from(products)
    .where(
      and(eq(products.isActive, true), or(eq(products.skuCode, q), eq(products.barcode, q))),
    )
    .limit(1);
  if (exact) return [exact];

  return db
    .select(POS_PRODUCT_COLUMNS)
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        or(
          homoglyphContains(products.name, q),
          homoglyphContains(products.skuCode, q),
          homoglyphContains(products.barcode, q),
        ),
      ),
    )
    .limit(8);
}

/** Distinct category tags for the browse-grid's filter tabs. */
export async function getProductCategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(and(eq(products.isActive, true), sql`${products.category} is not null`))
    .orderBy(asc(products.category));
  return rows.map((r) => r.category).filter((c): c is string => !!c);
}

const BROWSE_PAGE_SIZE = 100;

/**
 * Paginated grid browse (as opposed to searchProductsOnline's small
 * type-ahead result set) — backs the clickable product grid so cashiers can
 * browse/tap instead of only typing exact names. Only in-stock items are
 * shown — a zero-stock item can't be sold, so listing it just adds noise.
 */
export async function browseProducts(opts: {
  category: string | null;
  query: string;
  offset: number;
}) {
  const q = opts.query.trim();
  const where = and(
    eq(products.isActive, true),
    gt(products.stockQty, 0),
    opts.category ? eq(products.category, opts.category) : undefined,
    q
      ? or(
          homoglyphContains(products.name, q),
          homoglyphContains(products.skuCode, q),
          homoglyphContains(products.barcode, q),
        )
      : undefined,
  );

  const items = await db
    .select(POS_PRODUCT_COLUMNS)
    .from(products)
    .where(where)
    .orderBy(asc(products.name))
    .limit(BROWSE_PAGE_SIZE)
    .offset(opts.offset);

  return { items, hasMore: items.length === BROWSE_PAGE_SIZE };
}

export async function searchClientsOnline(query: string) {
  const q = query.trim();
  if (!q) return [];
  return db
    .select({ id: clients.id, fullName: clients.fullName, phone: clients.phone })
    .from(clients)
    .where(or(homoglyphContains(clients.fullName, q), homoglyphContains(clients.phone, q)))
    .limit(8);
}

/**
 * Feeds the background offline-cache sync in pos-screen.tsx: pulled in
 * chunks after the page is already interactive so a large catalog never
 * blocks the initial load, only the offline fallback.
 */
export async function getProductsBatch(offset: number, limit: number) {
  return db
    .select(POS_PRODUCT_COLUMNS)
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getClientsBatch(offset: number, limit: number) {
  return db
    .select({ id: clients.id, fullName: clients.fullName, phone: clients.phone })
    .from(clients)
    .orderBy(asc(clients.createdAt))
    .limit(limit)
    .offset(offset);
}

export type DebtPlanInput = {
  installments: number;
  firstDueDate: string; // YYYY-MM-DD
  markupPercent: number;
};

type CheckoutResult =
  | { ok: true; saleId: string; total: string; hadStockConflict?: boolean }
  | { ok: false; error: string; insufficientProductIds?: string[] };

/**
 * allowNegativeStock: used only when syncing a sale that was already
 * completed offline — the physical sale already happened, so it must be
 * recorded even if stock goes negative. It gets flagged for reconciliation
 * instead of being rejected. The live/online checkout path never sets this.
 */
export async function checkoutSale(
  clientUuid: string,
  items: CartItemInput[],
  paymentType: "cash" | "card" | "debt",
  clientId: string,
  opts?: { allowNegativeStock?: boolean; debtPlan?: DebtPlanInput; discount?: number },
): Promise<CheckoutResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Не авторизован" };
  }
  if (items.length === 0) {
    return { ok: false, error: "Корзина пуста" };
  }
  if (!clientId) {
    return { ok: false, error: "Выберите клиента для продажи" };
  }
  if (paymentType === "debt" && !opts?.debtPlan) {
    return { ok: false, error: "Укажите план платежей для продажи в долг" };
  }

  const [existing] = await db
    .select()
    .from(sales)
    .where(eq(sales.clientUuid, clientUuid))
    .limit(1);
  if (existing) {
    return { ok: true, saleId: existing.id, total: existing.total };
  }

  const [warehouse] = await db.select().from(warehouses).limit(1);
  const [cashAccount] = await db.select().from(cashAccounts).limit(1);
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!warehouse || !cashAccount) {
    return { ok: false, error: "Склад или касса не настроены" };
  }
  if (!client) {
    return { ok: false, error: "Клиент не найден" };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const catalog = await tx
        .select()
        .from(products)
        .where(inArray(products.id, items.map((i) => i.productId)));
      const catalogById = new Map(catalog.map((p) => [p.id, p]));

      const missingProductIds = items
        .filter((i) => !catalogById.has(i.productId))
        .map((i) => i.productId);
      if (missingProductIds.length > 0) {
        throw new CheckoutError(
          "Некоторые товары больше не существуют",
          missingProductIds,
        );
      }

      const subtotal = items.reduce(
        (sum, item) => sum + Number(catalogById.get(item.productId)!.salePrice) * item.qty,
        0,
      );
      const discount = Math.max(0, Math.min(subtotal, opts?.discount || 0));
      const total = subtotal - discount;

      const [sale] = await tx
        .insert(sales)
        .values({
          clientUuid,
          warehouseId: warehouse.id,
          cashierId: user.id,
          paymentType,
          clientId,
          subtotal: subtotal.toFixed(2),
          discount: discount.toFixed(2),
          total: total.toFixed(2),
          syncStatus: "synced",
        })
        .returning();

      const insufficientProductIds: string[] = [];
      let hadStockConflict = false;
      const receiptItems: ReceiptItem[] = [];

      for (const item of items) {
        const product = catalogById.get(item.productId)!;

        if (opts?.allowNegativeStock) {
          const [locked] = await tx
            .select({ stockQty: products.stockQty })
            .from(products)
            .where(eq(products.id, item.productId))
            .for("update");

          if (!locked || locked.stockQty < item.qty) {
            hadStockConflict = true;
          }

          await tx
            .update(products)
            .set({ stockQty: sql`${products.stockQty} - ${item.qty}`, updatedAt: new Date() })
            .where(eq(products.id, item.productId));
        } else {
          const updated = await tx
            .update(products)
            .set({ stockQty: sql`${products.stockQty} - ${item.qty}`, updatedAt: new Date() })
            .where(
              and(eq(products.id, item.productId), gte(products.stockQty, item.qty)),
            )
            .returning({ id: products.id });

          if (updated.length === 0) {
            insufficientProductIds.push(item.productId);
            continue;
          }
        }

        const lineTotal = Number(product.salePrice) * item.qty;

        await tx.insert(saleItems).values({
          saleId: sale.id,
          productId: item.productId,
          qty: item.qty,
          unitPriceAtSale: product.salePrice,
          lineTotal: lineTotal.toFixed(2),
        });

        await tx.insert(stockMovements).values({
          productId: item.productId,
          warehouseId: warehouse.id,
          type: "sale",
          qtyDelta: -item.qty,
          relatedSaleId: sale.id,
          createdBy: user.id,
          note: opts?.allowNegativeStock ? "Синхронизировано из офлайн-продажи" : null,
        });

        receiptItems.push({
          name: product.name,
          qty: item.qty,
          unitPrice: product.salePrice,
          lineTotal: lineTotal.toFixed(2),
        });
      }

      if (!opts?.allowNegativeStock && insufficientProductIds.length > 0) {
        throw new CheckoutError(
          "Недостаточно товара на складе",
          insufficientProductIds,
        );
      }

      if (hadStockConflict) {
        await tx.update(sales).set({ hadStockConflict: true }).where(eq(sales.id, sale.id));
      }

      if (paymentType === "cash") {
        await tx.insert(cashTransactions).values({
          cashAccountId: cashAccount.id,
          type: "sale_income",
          amount: total.toFixed(2),
          relatedSaleId: sale.id,
          cashierId: user.id,
        });
      }

      let debtTotal = 0;
      let markupAmount = 0;

      if (paymentType === "debt" && opts?.debtPlan) {
        const markupPercent = Math.max(0, Math.min(100, opts.debtPlan.markupPercent || 0));
        markupAmount = Math.round(total * (markupPercent / 100) * 100) / 100;
        debtTotal = Math.round((total + markupAmount) * 100) / 100;

        const [debt] = await tx
          .insert(debts)
          .values({
            clientId,
            saleId: sale.id,
            originalAmount: debtTotal.toFixed(2),
            remainingBalance: debtTotal.toFixed(2),
            markupAmount: markupAmount.toFixed(2),
            markupPercent: markupPercent.toFixed(2),
            status: "open",
          })
          .returning();

        const n = Math.max(1, Math.min(24, opts.debtPlan.installments));
        const baseAmount = Math.floor((debtTotal / n) * 100) / 100;
        const lastAmount = Math.round((debtTotal - baseAmount * (n - 1)) * 100) / 100;
        const firstDue = new Date(opts.debtPlan.firstDueDate);

        for (let i = 0; i < n; i++) {
          const dueDate = new Date(firstDue);
          dueDate.setMonth(dueDate.getMonth() + i);
          const amount = i === n - 1 ? lastAmount : baseAmount;
          await tx.insert(paymentSchedules).values({
            debtId: debt.id,
            installmentNumber: i + 1,
            dueDate: dueDate.toISOString().slice(0, 10),
            amountDue: amount.toFixed(2),
            status: "pending",
          });
        }
      }

      return {
        saleId: sale.id,
        total: total.toFixed(2),
        debtTotal: debtTotal.toFixed(2),
        markupAmount: markupAmount.toFixed(2),
        hadStockConflict,
        receiptItems,
      };
    });

    revalidatePath("/tovar");
    revalidatePath("/assortiment");
    revalidatePath("/klienty");
    revalidatePath("/dolgi");
    revalidatePath("/dengi");
    revalidatePath("/otchet-kassy");
    revalidatePath("/");

    const displayTotal = paymentType === "debt" ? result.debtTotal : result.total;

    void sendSaleReceipt(
      client,
      result.saleId,
      result.receiptItems,
      result.total,
      displayTotal,
      result.markupAmount,
      paymentType,
      opts?.debtPlan,
    );

    return {
      ok: true,
      saleId: result.saleId,
      total: displayTotal,
      hadStockConflict: result.hadStockConflict,
    };
  } catch (err) {
    if (err instanceof CheckoutError) {
      return {
        ok: false,
        error: err.message,
        insufficientProductIds: err.productIds,
      };
    }
    console.error(err);
    return { ok: false, error: "Ошибка при оформлении продажи" };
  }
}

async function sendSaleReceipt(
  client: typeof clients.$inferSelect,
  saleId: string,
  items: ReceiptItem[],
  subtotal: string,
  displayTotal: string,
  markupAmount: string,
  paymentType: "cash" | "card" | "debt",
  debtPlan?: DebtPlanInput,
) {
  const [requisites] = await db.select().from(companyRequisites).limit(1);
  const storeName = requisites?.legalName || "СантехТорг";

  const message = buildSaleReceiptText({
    storeName,
    clientName: client.fullName,
    items,
    total: displayTotal,
    paymentType,
    createdAt: new Date(),
    debtSummary: debtPlan
      ? {
          subtotal,
          markupAmount,
          markupPercent: debtPlan.markupPercent || 0,
          installments: debtPlan.installments,
          firstDueDate: debtPlan.firstDueDate,
        }
      : undefined,
  });

  if (client.telegramChatId) {
    await sendTelegramMessage(client.telegramChatId, message).catch(() => {});
  }

  await enqueueWhatsappMessage({
    clientId: client.id,
    type: "receipt",
    payloadRef: saleId,
    message,
  }).catch(() => {});
}

class CheckoutError extends Error {
  productIds: string[];
  constructor(message: string, productIds: string[]) {
    super(message);
    this.productIds = productIds;
  }
}
