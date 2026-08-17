"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { cashAccounts, cashShifts, cashTransactions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

type ActionResult = { error: string } | { ok: true };

export async function openShift(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Не авторизован" };

  const openingBalance = Number(String(formData.get("openingBalance") ?? "0").replace(",", "."));
  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    return { error: "Введите корректную сумму" };
  }

  const [cashAccount] = await db.select().from(cashAccounts).limit(1);
  if (!cashAccount) return { error: "Касса не настроена" };

  try {
    await db.insert(cashShifts).values({
      cashAccountId: cashAccount.id,
      cashierId: user.id,
      openingBalance: openingBalance.toFixed(2),
      status: "open",
    });
  } catch {
    return { error: "Смена уже открыта" };
  }

  revalidatePath("/otchet-kassy");
  return { ok: true };
}

export async function closeShift(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Не авторизован" };

  const shiftId = String(formData.get("shiftId") ?? "");
  const actualBalance = Number(String(formData.get("actualBalance") ?? "0").replace(",", "."));
  if (!shiftId || !Number.isFinite(actualBalance) || actualBalance < 0) {
    return { error: "Введите корректную сумму" };
  }

  const [shift] = await db.select().from(cashShifts).where(eq(cashShifts.id, shiftId));
  if (!shift || shift.status !== "open") return { error: "Смена уже закрыта" };

  const txs = await db.select().from(cashTransactions).where(eq(cashTransactions.cashAccountId, shift.cashAccountId));
  const delta = txs
    .filter((t) => new Date(t.createdAt) >= new Date(shift.openedAt))
    .reduce((sum, t) => {
      if (t.type === "sale_income" || t.type === "debt_payment") return sum + Number(t.amount);
      if (t.type === "payout") return sum - Number(t.amount);
      if (t.type === "adjustment") return sum + Number(t.amount);
      return sum;
    }, 0);

  const expected = Number(shift.openingBalance) + delta;

  await db
    .update(cashShifts)
    .set({
      status: "closed",
      closedAt: new Date(),
      closingBalanceExpected: expected.toFixed(2),
      closingBalanceActual: actualBalance.toFixed(2),
    })
    .where(eq(cashShifts.id, shiftId));

  await db.insert(cashTransactions).values({
    cashAccountId: shift.cashAccountId,
    type: "shift_close",
    amount: actualBalance.toFixed(2),
    cashierId: user.id,
    note: `Закрытие смены. Ожидалось: ${expected.toFixed(2)}, факт: ${actualBalance.toFixed(2)}`,
  });

  revalidatePath("/otchet-kassy");
  return { ok: true };
}
