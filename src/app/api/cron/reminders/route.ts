import { and, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { clients, companyRequisites, debts, paymentSchedules } from "@/db/schema";
import { enqueueWhatsappMessage } from "@/lib/notifications/queue";
import { buildPaymentReminderText } from "@/lib/receipts/text";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("x-cron-secret");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const [requisites] = await db.select().from(companyRequisites).limit(1);
  const storeName = requisites?.legalName || "СантехТорг";

  const due = await db
    .select({
      scheduleId: paymentSchedules.id,
      dueDate: paymentSchedules.dueDate,
      amountDue: paymentSchedules.amountDue,
      amountPaid: paymentSchedules.amountPaid,
      installmentNumber: paymentSchedules.installmentNumber,
      clientId: clients.id,
      clientName: clients.fullName,
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

  for (const row of due) {
    const remaining = Number(row.amountDue) - Number(row.amountPaid);
    const overdue = row.dueDate < today;
    const message = buildPaymentReminderText({
      storeName,
      clientName: row.clientName,
      amount: remaining,
      installmentNumber: row.installmentNumber,
      dueDate: row.dueDate,
      overdue,
    });

    await enqueueWhatsappMessage({
      clientId: row.clientId,
      type: overdue ? "overdue_notice" : "payment_reminder",
      payloadRef: row.scheduleId,
      message,
    });
    queued++;

    // Marked at enqueue time (not actual delivery time) so this endpoint
    // stays idempotent even though it's polled hourly by the WhatsApp bot —
    // a debt is reminded at most once per day regardless of poll frequency.
    await db
      .update(paymentSchedules)
      .set({ reminderSentAt: new Date() })
      .where(eq(paymentSchedules.id, row.scheduleId));
  }

  return NextResponse.json({ due: due.length, queued });
}
