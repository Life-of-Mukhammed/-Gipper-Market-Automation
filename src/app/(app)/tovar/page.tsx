import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProductFormDialog } from "./product-form-dialog";
import { ToggleActiveButton } from "./toggle-active-button";

export default async function TovarPage() {
  const allProducts = await db
    .select()
    .from(products)
    .orderBy(desc(products.createdAt));

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Товар</h1>
          <p className="text-sm text-muted-foreground">
            Управление товарами и остатками
          </p>
        </div>
        <ProductFormDialog />
      </div>

      <main className="flex-1 p-6">
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Артикул</TableHead>
                <TableHead>Штрихкод</TableHead>
                <TableHead>Наименование</TableHead>
                <TableHead>Ед.</TableHead>
                <TableHead className="text-right">Закупка</TableHead>
                <TableHead className="text-right">Продажа</TableHead>
                <TableHead className="text-right">Остаток</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Товаров пока нет
                  </TableCell>
                </TableRow>
              )}
              {allProducts.map((p) => (
                <TableRow key={p.id} className={!p.isActive ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-sm">{p.skuCode}</TableCell>
                  <TableCell className="font-mono text-sm">{p.barcode ?? "—"}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.unit}</TableCell>
                  <TableCell className="text-right">{p.purchasePrice}</TableCell>
                  <TableCell className="text-right">{p.salePrice}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        p.stockQty <= p.minStockThreshold
                          ? "text-destructive font-medium"
                          : ""
                      }
                    >
                      {p.stockQty}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? "default" : "secondary"}>
                      {p.isActive ? "активен" : "скрыт"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    <ProductFormDialog product={p} />
                    <ToggleActiveButton id={p.id} isActive={p.isActive} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
