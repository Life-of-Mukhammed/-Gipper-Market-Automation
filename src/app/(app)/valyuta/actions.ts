"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { currencyRates } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

type ActionResult = { error: string } | { ok: true };

export async function addCurrencyRate(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Не авторизован" };

  const currencyCode = String(formData.get("currencyCode") ?? "").trim().toUpperCase();
  const rateToBase = Number(String(formData.get("rateToBase") ?? "0").replace(",", "."));
  const effectiveDate = String(formData.get("effectiveDate") ?? "").trim();

  if (!currencyCode || !Number.isFinite(rateToBase) || rateToBase <= 0 || !effectiveDate) {
    return { error: "Заполните все поля корректно" };
  }

  await db.insert(currencyRates).values({
    currencyCode,
    rateToBase: rateToBase.toFixed(4),
    effectiveDate,
  });

  revalidatePath("/valyuta");
  return { ok: true };
}
