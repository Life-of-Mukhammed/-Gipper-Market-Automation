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
  payablePayments,
  payables,
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
  let appliedForReceipt = 0;

  try {
    await db.transaction(async (tx) => {
      const [debt] = await tx.select().from(debts).where(eq(debts.id, debtId)).for("update");
      if (!debt) throw new Error("Долг не найден");

      // The debt's own remainingBalance is the source of truth for how much
      // this payment actually pays off — capped so a payment can never
      // exceed what's owed. Payment-schedule installments (only present for
      // debts created through the POS installment flow; legacy-imported
      // debts have none) are just a best-effort breakdown on top of that,
      // not the basis for the amount applied.
      const appliedTotal = Math.min(amount, Number(debt.remainingBalance));

      let remainingToDistribute = appliedTotal;
      const schedules = await tx
        .select()
        .from(paymentSchedules)
        .where(eq(paymentSchedules.debtId, debtId))
        .orderBy(paymentSchedules.installmentNumber);

      for (const sch of schedules) {
        if (remainingToDistribute <= 0) break;
        const due = Number(sch.amountDue) - Number(sch.amountPaid);
        if (due <= 0) continue;
        const applied = Math.min(due, remainingToDistribute);
        remainingToDistribute -= applied;

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

      // No schedule covered the (remainder of the) payment — most commonly
      // because this debt has no schedules at all. Still record it so
      // payment history isn't silently dropped.
      if (remainingToDistribute > 0) {
        await tx.insert(debtPayments).values({
          debtId,
          amount: remainingToDistribute.toFixed(2),
          cashAccountId: cashAccount.id,
          cashierId: user.id,
        });
      }

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
      appliedForReceipt = appliedTotal;
    });
  } catch (err) {
    console.error(err);
    return { error: "Ошибка при записи платежа" };
  }

  revalidatePath("/dolgi");
  revalidatePath("/klienty");

  void sendDebtPaymentReceipt(clientIdForReceipt, debtId, appliedForReceipt, newBalanceForReceipt);

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

export async function createPayable(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Не авторизован" };

  const creditorName = String(formData.get("creditorName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "0").replace(",", "."));
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!creditorName) return { error: "Укажите кому должны" };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Введите корректную сумму" };

  await db.insert(payables).values({
    creditorName,
    phone: phone || null,
    originalAmount: amount.toFixed(2),
    remainingBalance: amount.toFixed(2),
    dueDate: dueDate || null,
    note: note || null,
    status: "open",
  });

  revalidatePath("/dolgi");
  return { ok: true };
}

export async function recordPayablePayment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Не авторизован" };

  const payableId = String(formData.get("payableId") ?? "");
  const amount = Number(String(formData.get("amount") ?? "0").replace(",", "."));

  if (!payableId || !Number.isFinite(amount) || amount <= 0) {
    return { error: "Введите корректную сумму" };
  }

  const [cashAccount] = await db.select().from(cashAccounts).limit(1);
  if (!cashAccount) return { error: "Касса не настроена" };

  try {
    await db.transaction(async (tx) => {
      const [payable] = await tx
        .select()
        .from(payables)
        .where(eq(payables.id, payableId))
        .for("update");
      if (!payable) throw new Error("Долг не найден");

      const newBalance = Math.max(0, Number(payable.remainingBalance) - amount);

      await tx
        .update(payables)
        .set({
          remainingBalance: newBalance.toFixed(2),
          status: newBalance <= 0 ? "paid" : "open",
        })
        .where(eq(payables.id, payableId));

      await tx.insert(payablePayments).values({
        payableId,
        amount: amount.toFixed(2),
        cashAccountId: cashAccount.id,
        cashierId: user.id,
      });

      await tx.insert(cashTransactions).values({
        cashAccountId: cashAccount.id,
        type: "payable_payment",
        amount: amount.toFixed(2),
        cashierId: user.id,
        note: `Оплата поставщику: ${payable.creditorName}`,
      });
    });
  } catch (err) {
    console.error(err);
    return { error: "Ошибка при записи платежа" };
  }

  revalidatePath("/dolgi");
  revalidatePath("/dengi");
  return { ok: true };
}

export async function markOverdueSchedules() {
  await db
    .update(paymentSchedules)
    .set({ status: "overdue" })
    .where(sql`due_date < current_date and status = 'pending'`);
  revalidatePath("/dolgi");
}
