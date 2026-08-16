import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";

const SESSION_COOKIE = "session_token";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({ userId, token, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);

  const row = result[0];
  if (!row) return null;
  if (row.session.expiresAt < new Date()) return null;
  if (!row.user.isActive) return null;

  return row.user;
}

export { SESSION_COOKIE };
