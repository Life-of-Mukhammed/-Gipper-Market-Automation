"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { companyRequisites } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

type ActionResult = { error: string } | { ok: true };

export async function saveRequisites(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Не авторизован" };

  const data = {
    legalName: String(formData.get("legalName") ?? "").trim(),
    taxId: String(formData.get("taxId") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    bankDetails: String(formData.get("bankDetails") ?? "").trim(),
    receiptFooterText: String(formData.get("receiptFooterText") ?? "").trim(),
  };

  const [existing] = await db.select().from(companyRequisites).limit(1);
  if (existing) {
    await db.update(companyRequisites).set(data).where(eq(companyRequisites.id, existing.id));
  } else {
    await db.insert(companyRequisites).values(data);
  }

  revalidatePath("/rekvizity");
  return { ok: true };
}
