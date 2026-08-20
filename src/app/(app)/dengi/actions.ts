"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { cashAccounts, cashTransactions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

type ActionResult = { error: string } | { ok: true };

export async function recordExpense(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Не авторизован" };

  const amount = Number(String(formData.get("amount") ?? "0").replace(",", "."));
  const category = String(formData.get("category") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Введите корректную сумму" };
  }
  if (!category) {
    return { error: "Укажите категорию расхода" };
  }

  const [cashAccount] = await db.select().from(cashAccounts).limit(1);
  if (!cashAccount) return { error: "Касса не настроена" };

  await db.insert(cashTransactions).values({
    cashAccountId: cashAccount.id,
    type: "payout",
    amount: amount.toFixed(2),
    category,
    note: note || null,
    cashierId: user.id,
  });

  revalidatePath("/dengi");
  revalidatePath("/analiz");
  revalidatePath("/otchet-kassy");
  return { ok: true };
}
