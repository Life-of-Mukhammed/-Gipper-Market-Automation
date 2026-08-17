import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, sales, users } from "@/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Наличные",
  card: "Карта",
  debt: "Долг",
};

export default async function ArhivPage() {
  const rows = await db
    .select({
      id: sales.id,
      createdAt: sales.createdAt,
      total: sales.total,
      paymentType: sales.paymentType,
      status: sales.status,
      hadStockConflict: sales.hadStockConflict,
      cashierName: users.fullName,
      clientName: clients.fullName,
    })
    .from(sales)
    .innerJoin(users, eq(users.id, sales.cashierId))
    .leftJoin(clients, eq(clients.id, sales.clientId))
    .orderBy(desc(sales.createdAt))
    .limit(200);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Архив</h1>
        <p className="text-sm text-muted-foreground">История продаж (последние 200)</p>
      </div>

      <main className="flex-1 p-6">
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Кассир</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Оплата</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Продаж пока нет
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    {new Date(r.createdAt).toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell>{r.cashierName}</TableCell>
                  <TableCell>{r.clientName ?? "—"}</TableCell>
                  <TableCell>{PAYMENT_LABELS[r.paymentType] ?? r.paymentType}</TableCell>
                  <TableCell className="text-right font-medium">
                    {Number(r.total).toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge variant={r.status === "completed" ? "default" : "secondary"}>
                        {r.status === "completed"
                          ? "завершена"
                          : r.status === "refunded"
                            ? "возврат"
                            : "отменена"}
                      </Badge>
                      {r.hadStockConflict && (
                        <Badge variant="destructive">требует внимания</Badge>
                      )}
                    </div>
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
