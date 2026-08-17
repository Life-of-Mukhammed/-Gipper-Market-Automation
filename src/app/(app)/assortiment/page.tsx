import { and, eq, gt, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/pagination-controls";
import { SearchBox } from "./search-box";

const PAGE_SIZE = 25;

export default async function AssortimentPage({
  searchParams,
}: PageProps<"/assortiment">) {
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const where = and(
    eq(products.isActive, true),
    gt(products.stockQty, 0),
    query
      ? or(
          ilike(products.name, `%${query}%`),
          ilike(products.skuCode, `%${query}%`),
          ilike(products.barcode, `%${query}%`),
        )
      : undefined,
  );

  const [rows, [{ count }]] = await Promise.all([
    db.select().from(products).where(where).orderBy(products.name).limit(PAGE_SIZE).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
  ]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold mb-3">Ассортимент</h1>
        <SearchBox />
      </div>

      <main className="flex-1 p-6">
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-12">
            {query ? "Ничего не найдено" : "Товаров пока нет"}
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {rows.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-1.5 py-4">
                <span className="font-medium leading-snug">{p.name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {p.skuCode}
                  {p.barcode ? ` · ${p.barcode}` : ""}
                </span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-semibold">{p.salePrice} сум</span>
                  <Badge variant={p.stockQty > p.minStockThreshold ? "default" : "destructive"}>
                    {p.stockQty} {p.unit}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <PaginationControls
          page={page}
          totalPages={Math.max(1, Math.ceil(count / PAGE_SIZE))}
          total={count}
          basePath="/assortiment"
        />
      </main>
    </div>
  );
}
