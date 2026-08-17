import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { cashAccounts, cashShifts, cashTransactions } from "@/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CloseShiftForm, OpenShiftForm } from "./shift-forms";

export default async function OtchetKassyPage() {
  const [cashAccount] = await db.select().from(cashAccounts).limit(1);

  const [openShiftRow] = cashAccount
    ? await db
        .select()
        .from(cashShifts)
        .where(and(eq(cashShifts.cashAccountId, cashAccount.id), eq(cashShifts.status, "open")))
    : [];

  let currentTotal = 0;
  if (openShiftRow) {
    const txs = await db
      .select()
      .from(cashTransactions)
      .where(
        and(
          eq(cashTransactions.cashAccountId, openShiftRow.cashAccountId),
          gte(cashTransactions.createdAt, openShiftRow.openedAt),
        ),
      );
    currentTotal = txs.reduce((sum, t) => {
      if (t.type === "sale_income" || t.type === "debt_payment") return sum + Number(t.amount);
      if (t.type === "payout") return sum - Number(t.amount);
      if (t.type === "adjustment") return sum + Number(t.amount);
      return sum;
    }, 0);
  }

  const history = cashAccount
    ? await db
        .select()
        .from(cashShifts)
        .where(and(eq(cashShifts.cashAccountId, cashAccount.id), eq(cashShifts.status, "closed")))
        .orderBy(desc(cashShifts.closedAt))
        .limit(15)
    : [];

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Отчёт по кассе</h1>
        <p className="text-sm text-muted-foreground">{cashAccount?.name ?? "КАССА"}</p>
      </div>

      <main className="flex-1 p-6 flex flex-col gap-6">
        {openShiftRow ? (
          <div className="rounded-md border bg-background p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Смена открыта</div>
                <div className="text-sm">
                  {new Date(openShiftRow.openedAt).toLocaleString("ru-RU")}
                </div>
              </div>
              <Badge>открыта</Badge>
            </div>
            <div className="flex gap-6">
              <div>
                <div className="text-sm text-muted-foreground">Начальная сумма</div>
                <div className="text-lg font-semibold">
                  {Number(openShiftRow.openingBalance).toLocaleString("ru-RU")}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Ожидаемая сумма сейчас</div>
                <div className="text-lg font-semibold">
                  {(Number(openShiftRow.openingBalance) + currentTotal).toLocaleString("ru-RU")}
                </div>
              </div>
            </div>
            <CloseShiftForm shiftId={openShiftRow.id} />
          </div>
        ) : (
          <OpenShiftForm />
        )}

        <div>
          <h2 className="font-medium mb-2">История смен</h2>
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Открыта</TableHead>
                  <TableHead>Закрыта</TableHead>
                  <TableHead className="text-right">Ожидалось</TableHead>
                  <TableHead className="text-right">Факт</TableHead>
                  <TableHead className="text-right">Разница</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Закрытых смен пока нет
                    </TableCell>
                  </TableRow>
                )}
                {history.map((s) => {
                  const diff = Number(s.closingBalanceActual) - Number(s.closingBalanceExpected);
                  return (
                    <TableRow key={s.id}>
                      <TableCell>{new Date(s.openedAt).toLocaleString("ru-RU")}</TableCell>
                      <TableCell>{s.closedAt ? new Date(s.closedAt).toLocaleString("ru-RU") : "—"}</TableCell>
                      <TableCell className="text-right">
                        {Number(s.closingBalanceExpected).toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(s.closingBalanceActual).toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell
                        className={`text-right ${diff !== 0 ? "text-destructive font-medium" : ""}`}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toLocaleString("ru-RU")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}
