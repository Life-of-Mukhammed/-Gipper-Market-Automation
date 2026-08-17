import Link from "next/link";
import { desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, debts, paymentSchedules, payables } from "@/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PayableFormDialog } from "./payable-form-dialog";
import { PayablePaymentDialog } from "./payable-payment-dialog";

export default async function DolgiPage({ searchParams }: PageProps<"/dolgi">) {
  const sp = await searchParams;
  const view = sp.view === "payable" ? "payable" : "receivable";
  const today = new Date().toISOString().slice(0, 10);

  const [receivableRows, payableRows, [{ totalReceivable }], [{ totalPayable }]] = await Promise.all([
    db
      .select({
        id: debts.id,
        clientName: clients.fullName,
        clientPhone: clients.phone,
        remainingBalance: debts.remainingBalance,
        status: debts.status,
        nextDueDate: sql<
          string | null
        >`(select min(due_date) from ${paymentSchedules} where ${paymentSchedules.debtId} = ${debts.id} and ${paymentSchedules.status} != 'paid')`,
      })
      .from(debts)
      .innerJoin(clients, eq(clients.id, debts.clientId))
      .where(ne(debts.status, "paid")),
    db
      .select()
      .from(payables)
      .where(ne(payables.status, "paid"))
      .orderBy(desc(payables.createdAt)),
    db
      .select({ totalReceivable: sql<string>`coalesce(sum(${debts.remainingBalance}), 0)` })
      .from(debts)
      .where(ne(debts.status, "paid")),
    db
      .select({ totalPayable: sql<string>`coalesce(sum(${payables.remainingBalance}), 0)` })
      .from(payables)
      .where(ne(payables.status, "paid")),
  ]);

  receivableRows.sort((a, b) => (a.nextDueDate ?? "9999").localeCompare(b.nextDueDate ?? "9999"));

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Долги</h1>
        <div className="grid grid-cols-2 gap-4 mt-3 max-w-md">
          <div>
            <div className="text-xs text-muted-foreground">Нам должны</div>
            <div className="text-lg font-semibold text-emerald-600">
              {Number(totalReceivable).toLocaleString("ru-RU")} сум
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Мы должны</div>
            <div className="text-lg font-semibold text-destructive">
              {Number(totalPayable).toLocaleString("ru-RU")} сум
            </div>
          </div>
        </div>
        <div className="flex gap-1 mt-4 border-b -mb-4">
          <Link
            href="/dolgi?view=receivable"
            className={`px-4 py-2 text-sm border-b-2 ${
              view === "receivable"
                ? "border-primary font-medium"
                : "border-transparent text-muted-foreground"
            }`}
          >
            Нам должны
          </Link>
          <Link
            href="/dolgi?view=payable"
            className={`px-4 py-2 text-sm border-b-2 ${
              view === "payable"
                ? "border-primary font-medium"
                : "border-transparent text-muted-foreground"
            }`}
          >
            Мы должны
          </Link>
        </div>
      </div>

      <main className="flex-1 p-6">
        {view === "receivable" ? (
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead className="text-right">Остаток долга</TableHead>
                  <TableHead>Ближайший платёж</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivableRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Активных долгов нет
                    </TableCell>
                  </TableRow>
                )}
                {receivableRows.map((d) => {
                  const overdue = d.nextDueDate ? d.nextDueDate < today : false;
                  return (
                    <TableRow key={d.id}>
                      <TableCell>{d.clientName}</TableCell>
                      <TableCell className="font-mono text-sm">{d.clientPhone}</TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(d.remainingBalance).toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell>{d.nextDueDate ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={overdue ? "destructive" : "secondary"}>
                          {overdue ? "просрочен" : "в графике"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dolgi/${d.id}`} className="text-sm text-primary hover:underline">
                          Открыть
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <PayableFormDialog />
            </div>
            <div className="rounded-md border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Кому должны</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead className="text-right">Остаток</TableHead>
                    <TableHead>Срок оплаты</TableHead>
                    <TableHead>Заметка</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payableRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Мы никому не должны
                      </TableCell>
                    </TableRow>
                  )}
                  {payableRows.map((p) => {
                    const overdue = p.dueDate ? p.dueDate < today : false;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{p.creditorName}</TableCell>
                        <TableCell className="font-mono text-sm">{p.phone ?? "—"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(p.remainingBalance).toLocaleString("ru-RU")}
                        </TableCell>
                        <TableCell>
                          {p.dueDate ? (
                            <span className={overdue ? "text-destructive" : ""}>{p.dueDate}</span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.note ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <PayablePaymentDialog payableId={p.id} remainingBalance={p.remainingBalance} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
