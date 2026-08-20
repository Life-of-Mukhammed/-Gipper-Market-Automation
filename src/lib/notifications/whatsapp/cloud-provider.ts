import type { WhatsappProvider, WhatsappSendResult } from "./types";

/**
 * Meta WhatsApp Cloud API provider — the only concrete implementation of
 * WhatsappProvider today. To switch providers later (e.g. a different
 * official Business Solution Provider), write another factory with the same
 * signature and swap it in service.ts; nothing else needs to change.
 */
export function createMetaCloudProvider(config: {
  apiUrl: string;
  accessToken: string;
  phoneNumberId: string;
}): WhatsappProvider {
  const endpoint = `${config.apiUrl.replace(/\/$/, "")}/${config.phoneNumberId}/messages`;

  async function callApi(body: Record<string, unknown>): Promise<WhatsappSendResult> {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const error = data?.error?.message || `WhatsApp API error: ${res.status}`;
        return { ok: false, error };
      }

      const providerMessageId = data?.messages?.[0]?.id;
      if (!providerMessageId) {
        return { ok: false, error: "WhatsApp API: no message id in response" };
      }

      return { ok: true, providerMessageId };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "WhatsApp API request failed" };
    }
  }

  return {
    async sendTemplateMessage({ to, templateName, languageCode, bodyParams }) {
      return callApi({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(bodyParams?.length
            ? {
                components: [
                  {
                    type: "body",
                    parameters: bodyParams.map((text) => ({ type: "text", text })),
                  },
                ],
              }
            : {}),
        },
      });
    },

    async sendTextMessage({ to, text }) {
      return callApi({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      });
    },
  };
}
