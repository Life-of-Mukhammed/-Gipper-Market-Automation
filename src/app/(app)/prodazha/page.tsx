import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, products } from "@/db/schema";
import { PosScreen } from "./pos-screen";

export default async function ProdazhaPage() {
  const [rows, clientRows] = await Promise.all([
    db
      .select({
        id: products.id,
        skuCode: products.skuCode,
        barcode: products.barcode,
        name: products.name,
        unit: products.unit,
        salePrice: products.salePrice,
        stockQty: products.stockQty,
      })
      .from(products)
      .where(eq(products.isActive, true)),
    db
      .select({ id: clients.id, fullName: clients.fullName, phone: clients.phone })
      .from(clients),
  ]);

  return <PosScreen products={rows} clients={clientRows} />;
}
