import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { clients } from "@/db/schema";
import { sendTelegramMessage } from "@/lib/notifications/telegram";

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const update = await request.json().catch(() => null);
  const message = update?.message;
  const text: string | undefined = message?.text;
  const chatId: string | undefined = message?.chat?.id?.toString();

  if (text?.startsWith("/start") && chatId) {
    const clientId = text.split(" ")[1]?.trim();
    if (clientId) {
      const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
      if (client) {
        await db.update(clients).set({ telegramChatId: chatId }).where(eq(clients.id, clientId));
        await sendTelegramMessage(
          chatId,
          `Здравствуйте, ${client.fullName}! Вы подключены к уведомлениям СантехТорг.`,
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
