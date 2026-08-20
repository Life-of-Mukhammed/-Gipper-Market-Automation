import { createMetaCloudProvider } from "./cloud-provider";
import { buildDebtReminderText, formatSum, formatUzDate, resolveTemplateName } from "./templates";
import type { ReminderType, WhatsappProvider, WhatsappSendResult } from "./types";

export function isWhatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_API_URL &&
      process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID,
  );
}

function getProvider(): WhatsappProvider | null {
  if (!isWhatsappConfigured()) return null;
  return createMetaCloudProvider({
    apiUrl: process.env.WHATSAPP_API_URL!,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
  });
}

/**
 * "template" (default) sends an approved WhatsApp template — required for
 * business-initiated messages outside the 24h customer-service window, i.e.
 * every scheduled debt reminder. "text" sends free-form text instead; only
 * useful for manual testing inside an active 24h session, since Meta will
 * reject free-form business-initiated sends otherwise.
 */
const SEND_MODE = process.env.WHATSAPP_SEND_MODE === "text" ? "text" : "template";
const TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "uz";

export const WhatsAppService = {
  isConfigured: isWhatsappConfigured,

  async sendTemplateMessage(params: {
    to: string;
    templateName: string;
    languageCode?: string;
    bodyParams?: string[];
  }): Promise<WhatsappSendResult> {
    const provider = getProvider();
    if (!provider) return { ok: false, error: "WhatsApp не настроен (заданы не все переменные окружения)" };
    return provider.sendTemplateMessage({
      to: params.to,
      templateName: params.templateName,
      languageCode: params.languageCode || TEMPLATE_LANGUAGE,
      bodyParams: params.bodyParams,
    });
  },

  async sendTextMessage(params: { to: string; text: string }): Promise<WhatsappSendResult> {
    const provider = getProvider();
    if (!provider) return { ok: false, error: "WhatsApp не настроен (заданы не все переменные окружения)" };
    return provider.sendTextMessage(params);
  },

  async sendDebtReminder(params: {
    to: string;
    reminderType: ReminderType;
    clientName: string;
    amount: number;
    dueDate: string;
  }): Promise<WhatsappSendResult> {
    if (SEND_MODE === "text") {
      return this.sendTextMessage({ to: params.to, text: buildDebtReminderText(params) });
    }

    const templateName = resolveTemplateName(params.reminderType);
    if (!templateName) {
      return {
        ok: false,
        error: `Шаблон WhatsApp не настроен для типа "${params.reminderType}" (переменная окружения не задана)`,
      };
    }

    // Dynamic slots only — the static wording lives in the template itself,
    // approved separately in Meta Business Manager. Adjust this parameter
    // list (order/count) to match however that approved template is set up.
    return this.sendTemplateMessage({
      to: params.to,
      templateName,
      bodyParams: [params.clientName, `${formatSum(params.amount)} so'm`, formatUzDate(params.dueDate)],
    });
  },
};
