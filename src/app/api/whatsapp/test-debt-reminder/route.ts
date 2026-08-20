import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendManualDebtReminder } from "@/lib/notifications/whatsapp/debt-reminders";
import { REMINDER_TYPES, type ReminderType } from "@/lib/notifications/whatsapp/types";

// Manual send for admins to verify WhatsApp delivery without waiting for a
// scheduled reminder date. Does not touch the automatic-reminder dedup table.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const debtId = body?.debtId;
  const reminderType = body?.reminderType ?? "due_date";

  if (!debtId || typeof debtId !== "string") {
    return NextResponse.json({ error: "debtId обязателен" }, { status: 400 });
  }
  if (!(REMINDER_TYPES as readonly string[]).includes(reminderType)) {
    return NextResponse.json({ error: "Некорректный reminderType" }, { status: 400 });
  }

  const result = await sendManualDebtReminder({ debtId, reminderType: reminderType as ReminderType });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true, providerMessageId: result.providerMessageId });
}
