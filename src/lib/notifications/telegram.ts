export function isTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN не настроен" };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Telegram API error: ${res.status} ${body}` };
  }

  return { ok: true };
}

export function getTelegramBotUsername() {
  return process.env.TELEGRAM_BOT_USERNAME ?? null;
}

export function buildClientLinkUrl(clientId: string) {
  const username = getTelegramBotUsername();
  if (!username) return null;
  return `https://t.me/${username}?start=${clientId}`;
}
