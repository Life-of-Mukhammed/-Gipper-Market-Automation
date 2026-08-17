import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, debts, paymentSchedules, debtPayments } from "@/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RecordPaymentForm } from "./record-payment-form";

export default async function DebtDetailPage({ params }: PageProps<"/dolgi/[id]">) {
  const { id } = await params;

  const [debt] = await db
    .select({
      id: debts.id,
      remainingBalance: debts.remainingBalance,
      originalAmount: debts.originalAmount,
      status: debts.status,
      clientName: clients.fullName,
      clientPhone: clients.phone,
      telegramChatId: clients.telegramChatId,
    })
    .from(debts)
    .innerJoin(clients, eq(clients.id, debts.clientId))
    .where(eq(debts.id, id));

  if (!debt) notFound();

  const schedule = await db
    .select()
    .from(paymentSchedules)
    .where(eq(paymentSchedules.debtId, id))
    .orderBy(paymentSchedules.installmentNumber);

  const payments = await db
    .select()
    .from(debtPayments)
    .where(eq(debtPayments.debtId, id))
    .orderBy(debtPayments.paidAt);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">{debt.clientName}</h1>
        <p className="text-sm text-muted-foreground font-mono">{debt.clientPhone}</p>
      </div>

      <main className="flex-1 p-6 flex flex-col gap-6">
        <div className="rounded-md border bg-background p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Первоначальная сумма</div>
            <div className="text-lg font-semibold">
              {Number(debt.originalAmount).toLocaleString("ru-RU")}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Остаток</div>
            <div className="text-lg font-semibold text-destructive">
              {Number(debt.remainingBalance).toLocaleString("ru-RU")}
            </div>
          </div>
          <div>
            <Badge variant={debt.status === "paid" ? "default" : "secondary"}>
              {debt.status === "paid" ? "погашен" : "открыт"}
            </Badge>
          </div>
          {debt.status !== "paid" && (
            <RecordPaymentForm debtId={debt.id} remainingBalance={debt.remainingBalance} />
          )}
        </div>

        <div>
          <h2 className="font-medium mb-2">График платежей</h2>
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Срок</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead className="text-right">Оплачено</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((s) => {
                  const overdue = s.status !== "paid" && s.dueDate < today;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>{s.installmentNumber}</TableCell>
                      <TableCell>{s.dueDate}</TableCell>
                      <TableCell className="text-right">
                        {Number(s.amountDue).toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(s.amountPaid).toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            s.status === "paid" ? "default" : overdue ? "destructive" : "secondary"
                          }
                        >
                          {s.status === "paid" ? "оплачено" : overdue ? "просрочено" : "ожидается"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {payments.length > 0 && (
          <div>
            <h2 className="font-medium mb-2">История платежей</h2>
            <div className="rounded-md border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.paidAt).toLocaleString("ru-RU")}</TableCell>
                      <TableCell className="text-right">
                        {Number(p.amount).toLocaleString("ru-RU")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
