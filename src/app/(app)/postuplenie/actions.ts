"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import {
  products,
  receivingDocuments,
  receivingItems,
  stockMovements,
  suppliers,
  warehouses,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

type ActionResult = { error: string } | { ok: true };

export async function createSupplier(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Не авторизован" };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) return { error: "Название обязательно" };

  await db.insert(suppliers).values({ name, phone: phone || null });
  revalidatePath("/postuplenie");
  return { ok: true };
}

export type ReceivingItemInput = {
  productId: string;
  qty: number;
  unitCost: number;
};

type ConfirmResult = { ok: true; documentId: string } | { ok: false; error: string };

export async function confirmReceiving(
  supplierId: string | null,
  items: ReceivingItemInput[],
): Promise<ConfirmResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Не авторизован" };
  if (items.length === 0) return { ok: false, error: "Добавьте хотя бы один товар" };

  const [warehouse] = await db.select().from(warehouses).limit(1);
  if (!warehouse) return { ok: false, error: "Склад не настроен" };

  try {
    const documentId = await db.transaction(async (tx) => {
      const totalAmount = items.reduce((sum, i) => sum + i.qty * i.unitCost, 0);

      const [doc] = await tx
        .insert(receivingDocuments)
        .values({
          supplierId: supplierId || null,
          warehouseId: warehouse.id,
          status: "confirmed",
          totalAmount: totalAmount.toFixed(2),
          createdBy: user.id,
          confirmedAt: new Date(),
        })
        .returning();

      for (const item of items) {
        await tx.insert(receivingItems).values({
          receivingDocumentId: doc.id,
          productId: item.productId,
          qty: item.qty,
          unitCost: item.unitCost.toFixed(2),
        });

        await tx
          .update(products)
          .set({
            stockQty: sql`${products.stockQty} + ${item.qty}`,
            purchasePrice: item.unitCost.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId));

        await tx.insert(stockMovements).values({
          productId: item.productId,
          warehouseId: warehouse.id,
          type: "receiving",
          qtyDelta: item.qty,
          relatedReceivingId: doc.id,
          createdBy: user.id,
        });
      }

      return doc.id;
    });

    revalidatePath("/postuplenie");
    revalidatePath("/tovar");
    revalidatePath("/assortiment");
    return { ok: true, documentId };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Ошибка при оприходовании" };
  }
}
