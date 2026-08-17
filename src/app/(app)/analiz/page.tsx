import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cashTransactions, products, saleItems, sales } from "@/db/schema";
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
  const fromDate = new Date(from);
  const toExclusiveDate = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000);

  const salesInRange = and(
    eq(sales.status, "completed"),
    gte(sales.createdAt, fromDate),
    lte(sales.createdAt, toExclusiveDate),
  );

  const [periodSales, cogsRow, expensesByCategory, dailySales, dailyExpenses, topProducts] =
    await Promise.all([
      db.select().from(sales).where(salesInRange),
      db
        .select({
          cogs: sql<string>`coalesce(sum(${saleItems.qty} * ${products.purchasePrice}), 0)`,
        })
        .from(saleItems)
        .innerJoin(sales, eq(sales.id, saleItems.saleId))
        .innerJoin(products, eq(products.id, saleItems.productId))
        .where(salesInRange),
      db
        .select({
          category: cashTransactions.category,
          total: sql<string>`sum(${cashTransactions.amount})`,
        })
        .from(cashTransactions)
        .where(
          and(
            eq(cashTransactions.type, "payout"),
            gte(cashTransactions.createdAt, fromDate),
            lte(cashTransactions.createdAt, toExclusiveDate),
          ),
        )
        .groupBy(cashTransactions.category)
        .orderBy(desc(sql`sum(${cashTransactions.amount})`)),
      db
        .select({
          day: sql<string>`to_char(${sales.createdAt}, 'YYYY-MM-DD')`,
          revenue: sql<string>`sum(${sales.total})`,
        })
        .from(sales)
        .where(salesInRange)
        .groupBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`),
      db
        .select({
          day: sql<string>`to_char(${cashTransactions.createdAt}, 'YYYY-MM-DD')`,
          expense: sql<string>`sum(${cashTransactions.amount})`,
        })
        .from(cashTransactions)
        .where(
          and(
            eq(cashTransactions.type, "payout"),
            gte(cashTransactions.createdAt, fromDate),
            lte(cashTransactions.createdAt, toExclusiveDate),
          ),
        )
        .groupBy(sql`to_char(${cashTransactions.createdAt}, 'YYYY-MM-DD')`),
      db
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
        .where(salesInRange)
        .groupBy(saleItems.productId, products.name, products.skuCode)
        .orderBy(desc(sql`sum(${saleItems.lineTotal})`))
        .limit(10),
    ]);

  const totalRevenue = periodSales.reduce((sum, s) => sum + Number(s.total), 0);
  const salesCount = periodSales.length;
  const avgCheck = salesCount > 0 ? totalRevenue / salesCount : 0;
  const cogs = Number(cogsRow[0]?.cogs ?? 0);
  const grossProfit = totalRevenue - cogs;
  const totalExpenses = expensesByCategory.reduce((sum, e) => sum + Number(e.total), 0);
  const netProfit = grossProfit - totalExpenses;

  const paymentBreakdown = periodSales.reduce(
    (acc, s) => {
      acc[s.paymentType] = (acc[s.paymentType] ?? 0) + Number(s.total);
      return acc;
    },
    {} as Record<string, number>,
  );

  const dailyMap = new Map<string, { revenue: number; expense: number }>();
  for (const d of dailySales) {
    dailyMap.set(d.day, { revenue: Number(d.revenue), expense: 0 });
  }
  for (const d of dailyExpenses) {
    const existing = dailyMap.get(d.day) ?? { revenue: 0, expense: 0 };
    existing.expense = Number(d.expense);
    dailyMap.set(d.day, existing);
  }
  const dailyRows = Array.from(dailyMap.entries())
    .map(([day, v]) => ({ day, ...v, profit: v.revenue - v.expense }))
    .sort((a, b) => b.day.localeCompare(a.day));
  const maxDailyValue = Math.max(1, ...dailyRows.map((d) => Math.max(d.revenue, d.expense)));

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Анализ</h1>
        <p className="text-sm text-muted-foreground">Продажи, расходы и прибыль за период</p>
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
              <div className="text-sm text-muted-foreground">Расходы</div>
              <div className="text-xl font-semibold text-destructive">
                {totalExpenses.toLocaleString("ru-RU")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-sm text-muted-foreground">Чистая прибыль (примерно)</div>
              <div className={`text-xl font-semibold ${netProfit < 0 ? "text-destructive" : "text-emerald-600"}`}>
                {netProfit.toLocaleString("ru-RU")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-sm text-muted-foreground">Продаж / средний чек</div>
              <div className="text-xl font-semibold">
                {salesCount} / {avgCheck.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="text-sm text-muted-foreground">Себестоимость проданного</div>
              <div className="text-lg font-medium">{cogs.toLocaleString("ru-RU")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-sm text-muted-foreground">Валовая прибыль</div>
              <div className="text-lg font-medium">{grossProfit.toLocaleString("ru-RU")}</div>
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
          <h2 className="font-medium mb-2">По дням</h2>
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead className="text-right">Выручка</TableHead>
                  <TableHead className="text-right">Расходы</TableHead>
                  <TableHead className="text-right">Прибыль</TableHead>
                  <TableHead className="w-48">Наглядно</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Нет данных за выбранный период
                    </TableCell>
                  </TableRow>
                )}
                {dailyRows.map((d) => (
                  <TableRow key={d.day}>
                    <TableCell className="text-sm">{d.day}</TableCell>
                    <TableCell className="text-right">{d.revenue.toLocaleString("ru-RU")}</TableCell>
                    <TableCell className="text-right text-destructive">
                      {d.expense.toLocaleString("ru-RU")}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${d.profit < 0 ? "text-destructive" : "text-emerald-600"}`}
                    >
                      {d.profit.toLocaleString("ru-RU")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="h-1.5 rounded bg-muted overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${(d.revenue / maxDailyValue) * 100}%` }}
                          />
                        </div>
                        <div className="h-1.5 rounded bg-muted overflow-hidden">
                          <div
                            className="h-full bg-destructive"
                            style={{ width: `${(d.expense / maxDailyValue) * 100}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="font-medium mb-2">Расходы по категориям</h2>
            <div className="rounded-md border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Категория</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensesByCategory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        Расходов не было
                      </TableCell>
                    </TableRow>
                  )}
                  {expensesByCategory.map((e) => (
                    <TableRow key={e.category ?? "—"}>
                      <TableCell>{e.category ?? "Без категории"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(e.total).toLocaleString("ru-RU")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
        </div>
      </main>
    </div>
  );
}
