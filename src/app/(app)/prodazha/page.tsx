import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { PosScreen } from "./pos-screen";

export default async function ProdazhaPage() {
  const rows = await db
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
    .where(eq(products.isActive, true));

  return <PosScreen products={rows} />;
}
