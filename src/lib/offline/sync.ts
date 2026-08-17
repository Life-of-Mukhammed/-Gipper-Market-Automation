import { checkoutSale } from "@/app/(app)/prodazha/actions";
import { getPosDb, type CachedClient, type CachedProduct, type OutboxSale } from "./db";

export async function cacheProducts(products: CachedProduct[]) {
  const db = getPosDb();
  if (!db) return;
  await db.transaction("rw", db.productsCache, async () => {
    await db.productsCache.clear();
    await db.productsCache.bulkPut(products);
  });
}

export async function getCachedProducts(): Promise<CachedProduct[]> {
  const db = getPosDb();
  if (!db) return [];
  return db.productsCache.toArray();
}

export async function cacheClients(clients: CachedClient[]) {
  const db = getPosDb();
  if (!db) return;
  await db.transaction("rw", db.clientsCache, async () => {
    await db.clientsCache.clear();
    await db.clientsCache.bulkPut(clients);
  });
}

export async function getCachedClients(): Promise<CachedClient[]> {
  const db = getPosDb();
  if (!db) return [];
  return db.clientsCache.toArray();
}

export async function queueOfflineSale(sale: OutboxSale) {
  const db = getPosDb();
  if (!db) return;
  await db.outbox.put(sale);
}

export async function getPendingCount(): Promise<number> {
  const db = getPosDb();
  if (!db) return 0;
  return db.outbox.where("status").anyOf(["pending", "failed"]).count();
}

export async function syncPendingOutbox(): Promise<{ synced: number; failed: number }> {
  const db = getPosDb();
  if (!db) return { synced: 0, failed: 0 };

  const pending = await db.outbox.where("status").anyOf(["pending", "failed"]).toArray();
  let synced = 0;
  let failed = 0;

  for (const sale of pending) {
    await db.outbox.update(sale.clientUuid, { status: "syncing" });
    try {
      const res = await checkoutSale(sale.clientUuid, sale.items, sale.paymentType, sale.clientId, {
        allowNegativeStock: true,
      });
      if (res.ok) {
        await db.outbox.delete(sale.clientUuid);
        synced++;
      } else {
        await db.outbox.update(sale.clientUuid, { status: "failed", lastError: res.error });
        failed++;
      }
    } catch {
      await db.outbox.update(sale.clientUuid, {
        status: "failed",
        lastError: "Нет соединения",
      });
      failed++;
    }
  }

  return { synced, failed };
}
