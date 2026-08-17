import { and, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { clients, debts, notificationJobs, paymentSchedules } from "@/db/schema";
import { isTelegramConfigured, sendTelegramMessage } from "@/lib/notifications/telegram";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("x-cron-secret");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const due = await db
    .select({
      scheduleId: paymentSchedules.id,
      dueDate: paymentSchedules.dueDate,
      amountDue: paymentSchedules.amountDue,
      amountPaid: paymentSchedules.amountPaid,
      installmentNumber: paymentSchedules.installmentNumber,
      clientId: clients.id,
      clientName: clients.fullName,
      telegramChatId: clients.telegramChatId,
    })
    .from(paymentSchedules)
    .innerJoin(debts, eq(debts.id, paymentSchedules.debtId))
    .innerJoin(clients, eq(clients.id, debts.clientId))
    .where(
      and(
        ne(paymentSchedules.status, "paid"),
        lte(paymentSchedules.dueDate, today),
        or(
          isNull(paymentSchedules.reminderSentAt),
          sql`${paymentSchedules.reminderSentAt}::date < ${today}::date`,
        ),
      ),
    );

  let queued = 0;
  let sent = 0;
  let skippedNoTelegram = 0;

  for (const row of due) {
    const remaining = Number(row.amountDue) - Number(row.amountPaid);
    const overdue = row.dueDate < today;
    const message = overdue
      ? `Здравствуйте, ${row.clientName}! Платёж №${row.installmentNumber} на сумму ${remaining.toLocaleString("ru-RU")} сум просрочен (срок был ${row.dueDate}). Просим оплатить задолженность в СантехТорг.`
      : `Здравствуйте, ${row.clientName}! Напоминаем: сегодня срок платежа №${row.installmentNumber} на сумму ${remaining.toLocaleString("ru-RU")} сум в СантехТорг.`;

    const [job] = await db
      .insert(notificationJobs)
      .values({
        type: overdue ? "overdue_notice" : "payment_reminder",
        channel: "telegram",
        targetClientId: row.clientId,
        payloadRef: row.scheduleId,
        message,
        status: "pending",
      })
      .returning();
    queued++;

    if (!row.telegramChatId) {
      skippedNoTelegram++;
      continue;
    }

    if (!isTelegramConfigured()) continue;

    const result = await sendTelegramMessage(row.telegramChatId, message);
    if (result.ok) {
      await db
        .update(notificationJobs)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(notificationJobs.id, job.id));
      await db
        .update(paymentSchedules)
        .set({ reminderSentAt: new Date() })
        .where(eq(paymentSchedules.id, row.scheduleId));
      sent++;
    } else {
      await db
        .update(notificationJobs)
        .set({ status: "failed", lastError: result.error, attempts: 1 })
        .where(eq(notificationJobs.id, job.id));
    }
  }

  return NextResponse.json({ due: due.length, queued, sent, skippedNoTelegram });
}
