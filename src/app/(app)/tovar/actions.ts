"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { products, warehouses } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

type ActionResult = { error: string } | { ok: true };

function parsePrice(value: FormDataEntryValue | null): string {
  const n = Number(String(value ?? "0").replace(",", "."));
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

function parseInt0(value: FormDataEntryValue | null): number {
  const n = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Не авторизован");
  return user;
}

async function defaultWarehouseId() {
  const [wh] = await db.select().from(warehouses).limit(1);
  return wh?.id ?? null;
}

export async function createProduct(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();

  const skuCode = String(formData.get("skuCode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim();
  const unit = String(formData.get("unit") ?? "шт").trim() || "шт";
  const category = String(formData.get("category") ?? "").trim();

  if (!skuCode || !name) {
    return { error: "Артикул и наименование обязательны" };
  }

  const warehouseId = await defaultWarehouseId();

  try {
    await db.insert(products).values({
      skuCode,
      name,
      barcode: barcode || null,
      unit,
      category: category || null,
      purchasePrice: parsePrice(formData.get("purchasePrice")),
      salePrice: parsePrice(formData.get("salePrice")),
      stockQty: parseInt0(formData.get("stockQty")),
      minStockThreshold: parseInt0(formData.get("minStockThreshold")),
      warehouseId,
    });
  } catch {
    return { error: "Товар с таким артикулом или штрихкодом уже существует" };
  }

  revalidatePath("/tovar");
  revalidatePath("/assortiment");
  return { ok: true };
}

export async function updateProduct(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  const skuCode = String(formData.get("skuCode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim();
  const unit = String(formData.get("unit") ?? "шт").trim() || "шт";
  const category = String(formData.get("category") ?? "").trim();

  if (!id || !skuCode || !name) {
    return { error: "Артикул и наименование обязательны" };
  }

  try {
    await db
      .update(products)
      .set({
        skuCode,
        name,
        barcode: barcode || null,
        unit,
        category: category || null,
        purchasePrice: parsePrice(formData.get("purchasePrice")),
        salePrice: parsePrice(formData.get("salePrice")),
        stockQty: parseInt0(formData.get("stockQty")),
        minStockThreshold: parseInt0(formData.get("minStockThreshold")),
        updatedAt: new Date(),
      })
      .where(eq(products.id, id));
  } catch {
    return { error: "Товар с таким артикулом или штрихкодом уже существует" };
  }

  revalidatePath("/tovar");
  revalidatePath("/assortiment");
  return { ok: true };
}

export async function setProductActive(id: string, isActive: boolean) {
  await requireUser();
  await db
    .update(products)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(products.id, id));
  revalidatePath("/tovar");
  revalidatePath("/assortiment");
}
