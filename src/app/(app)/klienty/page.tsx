import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, debts } from "@/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { buildClientLinkUrl } from "@/lib/notifications/telegram";
import { ListSearchBox } from "@/components/list-search-box";
import { PaginationControls } from "@/components/pagination-controls";
import { ClientFormDialog } from "./client-form-dialog";

const PAGE_SIZE = 50;

export default async function KlientyPage({ searchParams }: PageProps<"/klienty">) {
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const where = query
    ? or(ilike(clients.fullName, `%${query}%`), ilike(clients.phone, `%${query}%`))
    : undefined;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: clients.id,
        fullName: clients.fullName,
        phone: clients.phone,
        address: clients.address,
        notes: clients.notes,
        telegramChatId: clients.telegramChatId,
        totalDebt: sql<string>`coalesce(sum(${debts.remainingBalance}) filter (where ${debts.status} != 'paid'), 0)`,
      })
      .from(clients)
      .leftJoin(debts, eq(debts.clientId, clients.id))
      .where(where)
      .groupBy(clients.id)
      .orderBy(desc(clients.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(clients).where(where),
  ]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Клиенты</h1>
          <p className="text-sm text-muted-foreground">База клиентов и их задолженность</p>
        </div>
        <ClientFormDialog />
      </div>

      <div className="px-6 pt-4">
        <ListSearchBox basePath="/klienty" placeholder="Поиск по имени или телефону..." />
      </div>

      <main className="flex-1 p-6">
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Telegram</TableHead>
                <TableHead className="text-right">Долг</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {query ? "Ничего не найдено" : "Клиентов пока нет"}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.fullName}</TableCell>
                  <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.address ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.telegramChatId ? "default" : "secondary"}>
                        {c.telegramChatId ? "привязан" : "не привязан"}
                      </Badge>
                      {!c.telegramChatId &&
                        (() => {
                          const link = buildClientLinkUrl(c.id);
                          return link ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              ссылка
                            </a>
                          ) : null;
                        })()}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={Number(c.totalDebt) > 0 ? "text-destructive font-medium" : ""}>
                      {Number(c.totalDebt).toLocaleString("ru-RU")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <ClientFormDialog client={c} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <PaginationControls
          page={page}
          totalPages={Math.max(1, Math.ceil(count / PAGE_SIZE))}
          total={count}
          basePath="/klienty"
        />
      </main>
    </div>
  );
}
