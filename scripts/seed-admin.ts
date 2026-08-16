import "dotenv/config";
import { db } from "../src/db/client";
import { users, warehouses } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

  const [warehouse] = await db
    .insert(warehouses)
    .values({ name: "ГЛАВНЫЙ" })
    .onConflictDoNothing()
    .returning();

  await db
    .insert(users)
    .values({
      fullName: "Администратор",
      username,
      passwordHash: await hashPassword(password),
      role: "admin",
    })
    .onConflictDoNothing();

  console.log(`Готово. Склад: ${warehouse?.name ?? "ГЛАВНЫЙ (уже существует)"}`);
  console.log(`Логин: ${username}`);
  console.log(`Пароль: ${password}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
