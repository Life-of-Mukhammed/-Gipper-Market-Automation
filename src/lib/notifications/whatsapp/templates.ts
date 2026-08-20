import type { ReminderType } from "./types";

export function formatSum(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const UZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentyabr",
  "oktyabr",
  "noyabr",
  "dekabr",
];

/** dueDate is YYYY-MM-DD -> "30-avgust" */
export function formatUzDate(dueDate: string): string {
  const [, month, day] = dueDate.split("-").map(Number);
  return `${day}-${UZ_MONTHS[month - 1]}`;
}

/**
 * Free-form message text — used for WHATSAPP_SEND_MODE=text (manual testing
 * inside an active 24h customer-service session) and for previewing what a
 * template-mode send would say. Business-initiated production sends go
 * through sendTemplateMessage instead; see service.ts.
 */
export function buildDebtReminderText(params: {
  reminderType: ReminderType;
  clientName: string;
  amount: number;
  dueDate: string;
}): string {
  const { reminderType, clientName, amount, dueDate } = params;
  const sum = `${formatSum(amount)} so'm`;
  const date = formatUzDate(dueDate);

  switch (reminderType) {
    case "3_days_before":
      return `Assalomu alaykum, ${clientName}. Sizning ${sum} miqdoridagi qarzingizni to'lash muddati ${date}. Iltimos, to'lovni o'z vaqtida amalga oshiring.`;
    case "1_day_before":
      return `Assalomu alaykum, ${clientName}. Eslatib o'tamiz, ${sum} qarzingizni to'lash muddati ertaga, ${date}.`;
    case "due_date":
      return `Assalomu alaykum, ${clientName}. Bugun sizning ${sum} qarzingizni to'lash muddati. Iltimos, to'lovni amalga oshiring.`;
    case "1_day_after":
    case "3_days_after":
      return `Assalomu alaykum, ${clientName}. Sizning ${sum} qarzingiz bo'yicha to'lov muddati o'tgan. Iltimos, imkon qadar tezroq to'lovni amalga oshiring.`;
  }
}

const TEMPLATE_ENV_KEYS: Record<ReminderType, string> = {
  "3_days_before": "WHATSAPP_DEBT_REMINDER_3_DAYS",
  "1_day_before": "WHATSAPP_DEBT_REMINDER_1_DAY",
  due_date: "WHATSAPP_DEBT_REMINDER_DUE",
  "1_day_after": "WHATSAPP_DEBT_REMINDER_OVERDUE",
  "3_days_after": "WHATSAPP_DEBT_REMINDER_OVERDUE",
};

/** Approved Meta template name for a reminder type, from env — null until configured in Meta Business Manager. */
export function resolveTemplateName(reminderType: ReminderType): string | null {
  return process.env[TEMPLATE_ENV_KEYS[reminderType]] || null;
}
