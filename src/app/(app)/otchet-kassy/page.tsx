import { eq, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cashAccounts, cashTransactions, debts, payables, products } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";

export default async function OtchetKassyPage() {
  const [cashAccount] = await db.select().from(cashAccounts).limit(1);

  const [[{ cashBalance }], [{ totalReceivable }], [{ totalPayable }], [{ stockCostValue, stockSaleValue }]] =
    await Promise.all([
      cashAccount
        ? db
            .select({
              cashBalance: sql<string>`coalesce(sum(case
              when ${cashTransactions.type} in ('sale_income','debt_payment','adjustment') then ${cashTransactions.amount}
              when ${cashTransactions.type} in ('payout','payable_payment') then -${cashTransactions.amount}
              else 0
            end), 0)`,
            })
            .from(cashTransactions)
            .where(eq(cashTransactions.cashAccountId, cashAccount.id))
        : Promise.resolve([{ cashBalance: "0" }]),
      db
        .select({ totalReceivable: sql<string>`coalesce(sum(${debts.remainingBalance}), 0)` })
        .from(debts)
        .where(ne(debts.status, "paid")),
      db
        .select({ totalPayable: sql<string>`coalesce(sum(${payables.remainingBalance}), 0)` })
        .from(payables)
        .where(ne(payables.status, "paid")),
      db
        .select({
          stockCostValue: sql<string>`coalesce(sum(${products.stockQty} * ${products.purchasePrice}), 0)`,
          stockSaleValue: sql<string>`coalesce(sum(${products.stockQty} * ${products.salePrice}), 0)`,
        })
        .from(products)
        .where(eq(products.isActive, true)),
    ]);

  const netPosition = Number(cashBalance) + Number(totalReceivable) - Number(totalPayable);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Отчёт по кассе</h1>
        <p className="text-sm text-muted-foreground">{cashAccount?.name ?? "КАССА"}</p>
      </div>

      <main className="flex-1 p-6 flex flex-col gap-6">
        <div>
          <h2 className="font-medium mb-2">Полный отчёт</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="py-4">
                <div className="text-sm text-muted-foreground">Деньги в кассе (всего)</div>
                <div className="text-xl font-semibold">
                  {Number(cashBalance).toLocaleString("ru-RU")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-sm text-muted-foreground">Нам должны</div>
                <div className="text-xl font-semibold text-emerald-600">
                  {Number(totalReceivable).toLocaleString("ru-RU")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-sm text-muted-foreground">Мы должны</div>
                <div className="text-xl font-semibold text-destructive">
                  {Number(totalPayable).toLocaleString("ru-RU")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-sm text-muted-foreground">Итого (касса + нам − мы)</div>
                <div className={`text-xl font-semibold ${netPosition < 0 ? "text-destructive" : ""}`}>
                  {netPosition.toLocaleString("ru-RU")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-sm text-muted-foreground">Товар на складе (по закупке)</div>
                <div className="text-xl font-semibold">
                  {Number(stockCostValue).toLocaleString("ru-RU")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-sm text-muted-foreground">Товар на складе (по продаже)</div>
                <div className="text-xl font-semibold">
                  {Number(stockSaleValue).toLocaleString("ru-RU")}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
