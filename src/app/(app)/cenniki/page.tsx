import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { PriceTags } from "./price-tags";

export default async function CennikiPage() {
  const rows = await db
    .select({
      id: products.id,
      skuCode: products.skuCode,
      name: products.name,
      salePrice: products.salePrice,
    })
    .from(products)
    .where(eq(products.isActive, true));

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4 print:hidden">
        <h1 className="text-lg font-semibold">Ценники</h1>
        <p className="text-sm text-muted-foreground">Выберите товары и распечатайте ценники</p>
      </div>

      <main className="flex-1 p-6">
        <PriceTags products={rows} />
      </main>
    </div>
  );
}
