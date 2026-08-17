import Dexie, { type EntityTable } from "dexie";

export type CachedProduct = {
  id: string;
  skuCode: string;
  barcode: string | null;
  name: string;
  unit: string;
  salePrice: string;
  stockQty: number;
};

export type OutboxSale = {
  clientUuid: string;
  items: { productId: string; qty: number }[];
  paymentType: "cash" | "card";
  total: number;
  createdAt: number;
  status: "pending" | "syncing" | "failed";
  lastError?: string;
};

class PosDatabase extends Dexie {
  productsCache!: EntityTable<CachedProduct, "id">;
  outbox!: EntityTable<OutboxSale, "clientUuid">;

  constructor() {
    super("santehtorg-pos");
    this.version(1).stores({
      productsCache: "id, skuCode, barcode, name",
      outbox: "clientUuid, status, createdAt",
    });
  }
}

let instance: PosDatabase | null = null;

export function getPosDb() {
  if (typeof window === "undefined") return null;
  if (!instance) instance = new PosDatabase();
  return instance;
}
