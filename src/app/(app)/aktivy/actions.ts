"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { assets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

type ActionResult = { error: string } | { ok: true };

export async function createAsset(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Не авторизован" };

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const purchaseDate = String(formData.get("purchaseDate") ?? "").trim();
  const value = Number(String(formData.get("value") ?? "0").replace(",", "."));
  const note = String(formData.get("note") ?? "").trim();

  if (!name) return { error: "Название обязательно" };
  if (!Number.isFinite(value) || value < 0) return { error: "Введите корректную стоимость" };

  await db.insert(assets).values({
    name,
    category: category || null,
    purchaseDate: purchaseDate || null,
    value: value.toFixed(2),
    note: note || null,
  });

  revalidatePath("/aktivy");
  return { ok: true };
}

export async function toggleAssetActive(id: string, isActive: boolean) {
  const user = await getCurrentUser();
  if (!user) return;
  await db.update(assets).set({ isActive }).where(eq(assets.id, id));
  revalidatePath("/aktivy");
}
