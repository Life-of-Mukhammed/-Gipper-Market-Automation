import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cashAccounts, cashTransactions, users } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationControls } from "@/components/pagination-controls";
import { ExpenseForm } from "./expense-form";

const PAGE_SIZE = 25;

const TYPE_LABELS: Record<string, { label: string; sign: 1 | -1 | 0 }> = {
  sale_income: { label: "продажа", sign: 1 },
  debt_payment: { label: "нам заплатили долг", sign: 1 },
  payout: { label: "расход", sign: -1 },
  payable_payment: { label: "мы заплатили долг", sign: -1 },
  adjustment: { label: "корректировка", sign: 1 },
  shift_open: { label: "открытие смены", sign: 0 },
  shift_close: { label: "закрытие смены", sign: 0 },
};

export default async function DengiPage({ searchParams }: PageProps<"/dengi">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [cashAccount] = await db.select().from(cashAccounts).limit(1);

  const [balanceRow] = cashAccount
    ? await db
        .select({
          balance: sql<string>`coalesce(sum(case
            when ${cashTransactions.type} in ('sale_income','debt_payment','adjustment') then ${cashTransactions.amount}
            when ${cashTransactions.type} in ('payout','payable_payment') then -${cashTransactions.amount}
            else 0
          end), 0)`,
          totalExpenses: sql<string>`coalesce(sum(case when ${cashTransactions.type} in ('payout','payable_payment') then ${cashTransactions.amount} else 0 end), 0)`,
        })
        .from(cashTransactions)
        .where(eq(cashTransactions.cashAccountId, cashAccount.id))
    : [{ balance: "0", totalExpenses: "0" }];

  const [rows, [{ count }]] = cashAccount
    ? await Promise.all([
        db
          .select({
            id: cashTransactions.id,
            type: cashTransactions.type,
            amount: cashTransactions.amount,
            category: cashTransactions.category,
            note: cashTransactions.note,
            createdAt: cashTransactions.createdAt,
            cashierName: users.fullName,
          })
          .from(cashTransactions)
          .innerJoin(users, eq(users.id, cashTransactions.cashierId))
          .where(eq(cashTransactions.cashAccountId, cashAccount.id))
          .orderBy(desc(cashTransactions.createdAt))
          .limit(PAGE_SIZE)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(cashTransactions)
          .where(eq(cashTransactions.cashAccountId, cashAccount.id)),
      ])
    : [[], [{ count: 0 }]];

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Деньги</h1>
        <p className="text-sm text-muted-foreground">{cashAccount?.name ?? "КАССА"} — движение денег</p>
      </div>

      <main className="flex-1 p-6 flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="text-sm text-muted-foreground">Текущий баланс</div>
              <div className="text-2xl font-semibold">
                {Number(balanceRow.balance).toLocaleString("ru-RU")} сум
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-sm text-muted-foreground">Расходы всего</div>
              <div className="text-2xl font-semibold text-destructive">
                {Number(balanceRow.totalExpenses).toLocaleString("ru-RU")} сум
              </div>
            </CardContent>
          </Card>
        </div>

        <ExpenseForm />

        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Кассир</TableHead>
                <TableHead>Заметка</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Операций пока нет
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => {
                const meta = TYPE_LABELS[r.type] ?? { label: r.type, sign: 0 };
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {new Date(r.createdAt).toLocaleString("ru-RU")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.sign < 0 ? "destructive" : "secondary"}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.category ?? "—"}
                    </TableCell>
                    <TableCell>{r.cashierName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.note ?? "—"}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${meta.sign < 0 ? "text-destructive" : ""}`}
                    >
                      {meta.sign < 0 ? "−" : meta.sign > 0 ? "+" : ""}
                      {Number(r.amount).toLocaleString("ru-RU")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <PaginationControls
          page={page}
          totalPages={Math.max(1, Math.ceil(count / PAGE_SIZE))}
          total={count}
          basePath="/dengi"
        />
      </main>
    </div>
  );
}
