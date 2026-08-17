import Link from "next/link";
import { eq, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, debts, paymentSchedules } from "@/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function DolgiPage() {
  const rows = await db
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
    .where(ne(debts.status, "paid"));

  rows.sort((a, b) => (a.nextDueDate ?? "9999").localeCompare(b.nextDueDate ?? "9999"));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Долги</h1>
        <p className="text-sm text-muted-foreground">Активные задолженности клиентов</p>
      </div>

      <main className="flex-1 p-6">
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
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Активных долгов нет
                  </TableCell>
                </TableRow>
              )}
              {rows.map((d) => {
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
      </main>
    </div>
  );
}
