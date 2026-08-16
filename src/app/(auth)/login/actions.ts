"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";

export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Введите логин и пароль" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user || !user.isActive) {
    return { error: "Неверный логин или пароль" };
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    return { error: "Неверный логин или пароль" };
  }

  await createSession(user.id);
  redirect("/");
}
