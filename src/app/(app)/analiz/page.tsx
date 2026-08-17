import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { products, saleItems, sales } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DateRangeForm } from "./date-range-form";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default async function AnalizPage({ searchParams }: PageProps<"/analiz">) {
  const sp = await searchParams;
  const from = typeof sp.from === "string" && sp.from ? sp.from : daysAgo(30);
  const to = typeof sp.to === "string" && sp.to ? sp.to : daysAgo(0);
  const toExclusive = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const periodSales = await db
    .select()
    .from(sales)
    .where(
      and(
        eq(sales.status, "completed"),
        gte(sales.createdAt, new Date(from)),
        lte(sales.createdAt, new Date(toExclusive)),
      ),
    );

  const totalRevenue = periodSales.reduce((sum, s) => sum + Number(s.total), 0);
  const salesCount = periodSales.length;
  const avgCheck = salesCount > 0 ? totalRevenue / salesCount : 0;

  const topProducts = await db
    .select({
      productId: saleItems.productId,
      name: products.name,
      skuCode: products.skuCode,
      totalQty: sql<string>`sum(${saleItems.qty})`,
      totalRevenue: sql<string>`sum(${saleItems.lineTotal})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .innerJoin(products, eq(products.id, saleItems.productId))
    .where(
      and(
        eq(sales.status, "completed"),
        gte(sales.createdAt, new Date(from)),
        lte(sales.createdAt, new Date(toExclusive)),
      ),
    )
    .groupBy(saleItems.productId, products.name, products.skuCode)
    .orderBy(desc(sql`sum(${saleItems.lineTotal})`))
    .limit(10);

  const paymentBreakdown = periodSales.reduce(
    (acc, s) => {
      acc[s.paymentType] = (acc[s.paymentType] ?? 0) + Number(s.total);
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Анализ</h1>
        <p className="text-sm text-muted-foreground">Продажи и прибыль за период</p>
      </div>

      <main className="flex-1 p-6 flex flex-col gap-6">
        <DateRangeForm from={from} to={to} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="text-sm text-muted-foreground">Выручка</div>
              <div className="text-xl font-semibold">{totalRevenue.toLocaleString("ru-RU")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-sm text-muted-foreground">Продаж</div>
              <div className="text-xl font-semibold">{salesCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-sm text-muted-foreground">Средний чек</div>
              <div className="text-xl font-semibold">
                {avgCheck.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-sm text-muted-foreground">Наличные / Карта / Долг</div>
              <div className="text-sm font-medium">
                {(paymentBreakdown.cash ?? 0).toLocaleString("ru-RU")} /{" "}
                {(paymentBreakdown.card ?? 0).toLocaleString("ru-RU")} /{" "}
                {(paymentBreakdown.debt ?? 0).toLocaleString("ru-RU")}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="font-medium mb-2">Топ товаров по выручке</h2>
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead className="text-right">Кол-во</TableHead>
                  <TableHead className="text-right">Выручка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Нет продаж за выбранный период
                    </TableCell>
                  </TableRow>
                )}
                {topProducts.map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell>
                      {p.name}{" "}
                      <span className="text-xs text-muted-foreground font-mono">{p.skuCode}</span>
                    </TableCell>
                    <TableCell className="text-right">{p.totalQty}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(p.totalRevenue).toLocaleString("ru-RU")}
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
