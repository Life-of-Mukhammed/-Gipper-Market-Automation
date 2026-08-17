import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { products, receivingDocuments, suppliers } from "@/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReceivingForm } from "./receiving-form";
import { SupplierDialog } from "./supplier-dialog";

export default async function PostupleniePage() {
  const [productRows, supplierRows, history] = await Promise.all([
    db
      .select({
        id: products.id,
        skuCode: products.skuCode,
        name: products.name,
        purchasePrice: products.purchasePrice,
        salePrice: products.salePrice,
      })
      .from(products)
      .where(eq(products.isActive, true)),
    db.select().from(suppliers),
    db
      .select({
        id: receivingDocuments.id,
        totalAmount: receivingDocuments.totalAmount,
        confirmedAt: receivingDocuments.confirmedAt,
        supplierName: suppliers.name,
      })
      .from(receivingDocuments)
      .leftJoin(suppliers, eq(suppliers.id, receivingDocuments.supplierId))
      .orderBy(desc(receivingDocuments.createdAt))
      .limit(20),
  ]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Поступление</h1>
          <p className="text-sm text-muted-foreground">Приход товара от поставщиков</p>
        </div>
        <SupplierDialog />
      </div>

      <main className="flex-1 p-6 flex flex-col gap-6">
        <ReceivingForm products={productRows} suppliers={supplierRows} />

        <div>
          <h2 className="font-medium mb-2">История поступлений</h2>
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Поставщик</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Поступлений пока нет
                    </TableCell>
                  </TableRow>
                )}
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      {h.confirmedAt ? new Date(h.confirmedAt).toLocaleString("ru-RU") : "—"}
                    </TableCell>
                    <TableCell>{h.supplierName ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(h.totalAmount).toLocaleString("ru-RU")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}
