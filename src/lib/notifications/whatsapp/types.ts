export type WhatsappSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string };

/**
 * Anything sending WhatsApp messages talks to this interface, not to a
 * specific vendor's HTTP API — swap in a different provider (see
 * cloud-provider.ts) without touching debt-reminders.ts or service.ts.
 */
export interface WhatsappProvider {
  sendTemplateMessage(params: {
    to: string;
    templateName: string;
    languageCode: string;
    bodyParams?: string[];
  }): Promise<WhatsappSendResult>;
  sendTextMessage(params: { to: string; text: string }): Promise<WhatsappSendResult>;
}

export const REMINDER_TYPES = [
  "3_days_before",
  "1_day_before",
  "due_date",
  "1_day_after",
  "3_days_after",
] as const;

export type ReminderType = (typeof REMINDER_TYPES)[number];

export const REMINDER_OFFSET_DAYS: Record<ReminderType, number> = {
  "3_days_before": -3,
  "1_day_before": -1,
  due_date: 0,
  "1_day_after": 1,
  "3_days_after": 3,
};

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  "3_days_before": "За 3 дня до срока",
  "1_day_before": "За 1 день до срока",
  due_date: "В день срока",
  "1_day_after": "Просрочка (1 день)",
  "3_days_after": "Просрочка (3 дня)",
};
