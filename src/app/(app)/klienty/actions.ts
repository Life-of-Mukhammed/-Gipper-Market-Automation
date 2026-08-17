"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { clients } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

type ActionResult = { error: string } | { ok: true };

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Не авторизован");
  return user;
}

export async function createClient(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!fullName || !phone) {
    return { error: "Имя и телефон обязательны" };
  }

  await db.insert(clients).values({
    fullName,
    phone,
    address: address || null,
    notes: notes || null,
  });

  revalidatePath("/klienty");
  return { ok: true };
}

export async function updateClient(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!id || !fullName || !phone) {
    return { error: "Имя и телефон обязательны" };
  }

  await db
    .update(clients)
    .set({ fullName, phone, address: address || null, notes: notes || null })
    .where(eq(clients.id, id));

  revalidatePath("/klienty");
  return { ok: true };
}
