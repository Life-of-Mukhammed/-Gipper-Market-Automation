import { and, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, debtReminders, debts, paymentSchedules } from "@/db/schema";
import { normalizeWhatsappPhone } from "./phone";
import { WhatsAppService } from "./service";
import { REMINDER_OFFSET_DAYS, REMINDER_TYPES, type ReminderType, type WhatsappSendResult } from "./types";

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Matches the "today" convention used elsewhere in this codebase (e.g.
// /api/cron/reminders) — a UTC-based date string, not true server-local
// time. Kept consistent rather than introducing a second definition of
// "today" for just this feature.
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function matchReminderType(dueDate: string, today: string): ReminderType | null {
  for (const type of REMINDER_TYPES) {
    if (addDays(today, REMINDER_OFFSET_DAYS[type]) === dueDate) return type;
  }
  return null;
}

type DueSchedule = {
  scheduleId: string;
  dueDate: string;
  amountDue: string;
  amountPaid: string;
  scheduleStatus: string;
  debtId: string;
  debtStatus: string;
  debtRemainingBalance: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
};

async function findDueSchedules(today: string): Promise<DueSchedule[]> {
  const from = addDays(today, -3);
  const to = addDays(today, 3);

  return db
    .select({
      scheduleId: paymentSchedules.id,
      dueDate: paymentSchedules.dueDate,
      amountDue: paymentSchedules.amountDue,
      amountPaid: paymentSchedules.amountPaid,
      scheduleStatus: paymentSchedules.status,
      debtId: debts.id,
      debtStatus: debts.status,
      debtRemainingBalance: debts.remainingBalance,
      clientId: clients.id,
      clientName: clients.fullName,
      clientPhone: clients.phone,
    })
    .from(paymentSchedules)
    .innerJoin(debts, eq(debts.id, paymentSchedules.debtId))
    .innerJoin(clients, eq(clients.id, debts.clientId))
    .where(
      and(
        ne(paymentSchedules.status, "paid"),
        gte(paymentSchedules.dueDate, from),
        lte(paymentSchedules.dueDate, to),
      ),
    );
}

export type ReminderRunSummary = {
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
};

/**
 * Called by /api/cron/whatsapp-debt-reminders on a schedule. Idempotent: a
 * given (paymentScheduleId, reminderType) pair is sent at most once, tracked
 * via the debt_reminders table's unique index — safe to run this multiple
 * times a day, and safe across server restarts since state lives in the DB,
 * not in memory.
 */
export async function processDebtReminders(): Promise<ReminderRunSummary> {
  console.log("[Debt Reminder] Processing started");
  const today = todayIso();
  const summary: ReminderRunSummary = { checked: 0, sent: 0, failed: 0, skipped: 0 };

  let schedules: DueSchedule[];
  try {
    schedules = await findDueSchedules(today);
  } catch (err) {
    console.error("[Debt Reminder] Failed to load due schedules", err);
    console.log("[Debt Reminder] Processing completed");
    return summary;
  }

  for (const s of schedules) {
    const reminderType = matchReminderType(s.dueDate, today);
    if (!reminderType) continue;
    summary.checked++;

    // Isolated per-schedule so one bad row (API failure, unexpected data)
    // never aborts the rest of the run.
    try {
      const outcome = await processOneReminder(s, reminderType);
      summary[outcome]++;
    } catch (err) {
      console.error(`[Debt Reminder] Unexpected error for schedule ${s.scheduleId}`, err);
      summary.failed++;
    }
  }

  console.log(
    `[Debt Reminder] Processing completed: checked=${summary.checked} sent=${summary.sent} failed=${summary.failed} skipped=${summary.skipped}`,
  );
  return summary;
}

async function processOneReminder(
  s: DueSchedule,
  reminderType: ReminderType,
): Promise<"sent" | "failed" | "skipped"> {
  const remainingSchedule = Number(s.amountDue) - Number(s.amountPaid);
  if (
    s.debtStatus === "paid" ||
    Number(s.debtRemainingBalance) <= 0 ||
    s.scheduleStatus === "paid" ||
    remainingSchedule <= 0
  ) {
    return "skipped";
  }

  const phone = normalizeWhatsappPhone(s.clientPhone);
  if (!phone) {
    console.log(`[Debt Reminder] Skipping schedule ${s.scheduleId}: invalid phone number`);
    return "skipped";
  }

  const [existing] = await db
    .select()
    .from(debtReminders)
    .where(
      and(eq(debtReminders.paymentScheduleId, s.scheduleId), eq(debtReminders.reminderType, reminderType)),
    )
    .limit(1);

  if (existing?.status === "sent") {
    return "skipped";
  }

  let reminderId: string;
  if (existing) {
    reminderId = existing.id;
  } else {
    const [inserted] = await db
      .insert(debtReminders)
      .values({
        debtId: s.debtId,
        paymentScheduleId: s.scheduleId,
        clientId: s.clientId,
        reminderType,
        scheduledDate: s.dueDate,
        status: "pending",
      })
      .returning({ id: debtReminders.id });
    reminderId = inserted.id;
  }

  console.log(`[WhatsApp] Sending reminder (debt ${s.debtId}, type ${reminderType})`);
  const result = await WhatsAppService.sendDebtReminder({
    to: phone,
    reminderType,
    clientName: s.clientName,
    amount: remainingSchedule,
    dueDate: s.dueDate,
  });

  await applyResult(reminderId, result);

  if (result.ok) {
    console.log(`[WhatsApp] Message sent (debt ${s.debtId}, type ${reminderType})`);
    return "sent";
  }
  console.error(`[WhatsApp] Message failed (debt ${s.debtId}, type ${reminderType}): ${result.error}`);
  return "failed";
}

async function applyResult(reminderId: string, result: WhatsappSendResult) {
  if (result.ok) {
    await db
      .update(debtReminders)
      .set({ status: "sent", sentAt: new Date(), providerMessageId: result.providerMessageId, errorMessage: null })
      .where(eq(debtReminders.id, reminderId));
  } else {
    await db
      .update(debtReminders)
      .set({ status: "failed", errorMessage: result.error })
      .where(eq(debtReminders.id, reminderId));
  }
}

/**
 * Manual test send (used by POST /api/whatsapp/test-debt-reminder) — sends
 * immediately regardless of due date, and deliberately does NOT touch the
 * debt_reminders dedup table, so it can never block or be blocked by the
 * scheduled reminders above.
 */
export async function sendManualDebtReminder(params: {
  debtId: string;
  reminderType: ReminderType;
}): Promise<WhatsappSendResult> {
  const [debt] = await db.select().from(debts).where(eq(debts.id, params.debtId)).limit(1);
  if (!debt) return { ok: false, error: "Долг не найден" };
  if (debt.status === "paid" || Number(debt.remainingBalance) <= 0) {
    return { ok: false, error: "Долг уже погашен" };
  }

  const [client] = await db.select().from(clients).where(eq(clients.id, debt.clientId)).limit(1);
  if (!client) return { ok: false, error: "Клиент не найден" };

  const phone = normalizeWhatsappPhone(client.phone);
  if (!phone) return { ok: false, error: "Некорректный номер телефона клиента" };

  const [nextSchedule] = await db
    .select()
    .from(paymentSchedules)
    .where(and(eq(paymentSchedules.debtId, params.debtId), ne(paymentSchedules.status, "paid")))
    .orderBy(paymentSchedules.dueDate)
    .limit(1);

  const dueDate = nextSchedule?.dueDate ?? todayIso();
  const amount = nextSchedule
    ? Number(nextSchedule.amountDue) - Number(nextSchedule.amountPaid)
    : Number(debt.remainingBalance);

  console.log(`[Debt Reminder] Sending manual test reminder ${params.reminderType} for debt ${params.debtId}`);
  console.log("[WhatsApp] Sending reminder");

  const result = await WhatsAppService.sendDebtReminder({
    to: phone,
    reminderType: params.reminderType,
    clientName: client.fullName,
    amount,
    dueDate,
  });

  if (result.ok) {
    console.log(`[WhatsApp] Message sent (manual test, debt ${params.debtId})`);
  } else {
    console.error(`[WhatsApp] Message failed (manual test, debt ${params.debtId}): ${result.error}`);
  }

  return result;
}
