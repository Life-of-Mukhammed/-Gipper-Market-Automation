import { NextRequest, NextResponse } from "next/server";
import { processDebtReminders } from "@/lib/notifications/whatsapp/debt-reminders";

// Hit on a schedule via Railway Cron Schedule, same convention as
// /api/cron/reminders — see .env.example for CRON_SECRET setup.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.nextUrl.searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const summary = await processDebtReminders();
  return NextResponse.json(summary);
}
