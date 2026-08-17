import { db } from "@/db/client";
import { notificationJobs } from "@/db/schema";

export async function enqueueWhatsappMessage(params: {
  clientId: string;
  type: "receipt" | "payment_reminder" | "overdue_notice";
  payloadRef: string;
  message: string;
}) {
  await db.insert(notificationJobs).values({
    type: params.type,
    channel: "whatsapp",
    targetClientId: params.clientId,
    payloadRef: params.payloadRef,
    message: params.message,
    status: "pending",
  });
}
