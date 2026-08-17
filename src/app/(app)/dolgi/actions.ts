"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import {
  cashAccounts,
  cashTransactions,
  clients,
  companyRequisites,
  debtPayments,
  debts,
  paymentSchedules,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import { enqueueWhatsappMessage } from "@/lib/notifications/queue";
import { buildDebtPaymentReceiptText } from "@/lib/receipts/text";

type ActionResult = { error: string } | { ok: true };

export async function recordDebtPayment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Не авторизован" };

  const debtId = String(formData.get("debtId") ?? "");
  const amount = Number(String(formData.get("amount") ?? "0").replace(",", "."));

  if (!debtId || !Number.isFinite(amount) || amount <= 0) {
    return { error: "Введите корректную сумму" };
  }

  const [cashAccount] = await db.select().from(cashAccounts).limit(1);
  if (!cashAccount) return { error: "Касса не настроена" };

  let newBalanceForReceipt = 0;
  let clientIdForReceipt = "";

  try {
    await db.transaction(async (tx) => {
      const [debt] = await tx.select().from(debts).where(eq(debts.id, debtId)).for("update");
      if (!debt) throw new Error("Долг не найден");

      let remaining = amount;
      const schedules = await tx
        .select()
        .from(paymentSchedules)
        .where(eq(paymentSchedules.debtId, debtId))
        .orderBy(paymentSchedules.installmentNumber);

      for (const sch of schedules) {
        if (remaining <= 0) break;
        const due = Number(sch.amountDue) - Number(sch.amountPaid);
        if (due <= 0) continue;
        const applied = Math.min(due, remaining);
        remaining -= applied;

        const newPaid = Number(sch.amountPaid) + applied;
        await tx
          .update(paymentSchedules)
          .set({
            amountPaid: newPaid.toFixed(2),
            status: newPaid >= Number(sch.amountDue) ? "paid" : "pending",
          })
          .where(eq(paymentSchedules.id, sch.id));

        await tx.insert(debtPayments).values({
          debtId,
          paymentScheduleId: sch.id,
          amount: applied.toFixed(2),
          cashAccountId: cashAccount.id,
          cashierId: user.id,
        });
      }

      const appliedTotal = amount - remaining;
      const newBalance = Math.max(0, Number(debt.remainingBalance) - appliedTotal);

      await tx
        .update(debts)
        .set({
          remainingBalance: newBalance.toFixed(2),
          status: newBalance <= 0 ? "paid" : "open",
        })
        .where(eq(debts.id, debtId));

      await tx.insert(cashTransactions).values({
        cashAccountId: cashAccount.id,
        type: "debt_payment",
        amount: appliedTotal.toFixed(2),
        cashierId: user.id,
        note: `Оплата долга ${debtId}`,
      });

      newBalanceForReceipt = newBalance;
      clientIdForReceipt = debt.clientId;
    });
  } catch (err) {
    console.error(err);
    return { error: "Ошибка при записи платежа" };
  }

  revalidatePath("/dolgi");
  revalidatePath("/klienty");

  void sendDebtPaymentReceipt(clientIdForReceipt, debtId, amount, newBalanceForReceipt);

  return { ok: true };
}

async function sendDebtPaymentReceipt(
  clientId: string,
  debtId: string,
  paidAmount: number,
  remainingBalance: number,
) {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) return;

  const [requisites] = await db.select().from(companyRequisites).limit(1);
  const storeName = requisites?.legalName || "СантехТорг";

  const message = buildDebtPaymentReceiptText({
    storeName,
    clientName: client.fullName,
    paidAmount,
    remainingBalance,
    createdAt: new Date(),
  });

  if (client.telegramChatId) {
    await sendTelegramMessage(client.telegramChatId, message).catch(() => {});
  }

  await enqueueWhatsappMessage({
    clientId: client.id,
    type: "receipt",
    payloadRef: debtId,
    message,
  }).catch(() => {});
}

export async function markOverdueSchedules() {
  await db
    .update(paymentSchedules)
    .set({ status: "overdue" })
    .where(sql`due_date < current_date and status = 'pending'`);
  revalidatePath("/dolgi");
}
