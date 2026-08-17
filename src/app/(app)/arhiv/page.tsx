import Link from "next/link";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, products, sales, stockMovements, users } from "@/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ListSearchBox } from "@/components/list-search-box";
import { PaginationControls } from "@/components/pagination-controls";

const PAGE_SIZE = 25;

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Наличные",
  card: "Карта",
  debt: "Долг",
};

const MOVEMENT_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  sale: { label: "продажа", variant: "secondary" },
  receiving: { label: "приход", variant: "default" },
  adjustment: { label: "корректировка", variant: "secondary" },
  writeoff: { label: "списание", variant: "destructive" },
};

async function loadClientArchive(query: string, offset: number) {
  const where = query
    ? or(ilike(clients.fullName, `%${query}%`), ilike(clients.phone, `%${query}%`))
    : undefined;

  return Promise.all([
    db
      .select({
        id: sales.id,
        createdAt: sales.createdAt,
        total: sales.total,
        paymentType: sales.paymentType,
        status: sales.status,
        hadStockConflict: sales.hadStockConflict,
        cashierName: users.fullName,
        clientName: clients.fullName,
        clientPhone: clients.phone,
      })
      .from(sales)
      .innerJoin(users, eq(users.id, sales.cashierId))
      .leftJoin(clients, eq(clients.id, sales.clientId))
      .where(where)
      .orderBy(desc(sales.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sales)
      .leftJoin(clients, eq(clients.id, sales.clientId))
      .where(where),
  ]);
}

async function loadProductArchive(query: string, offset: number) {
  const where = query
    ? or(ilike(products.name, `%${query}%`), ilike(products.skuCode, `%${query}%`))
    : undefined;

  return Promise.all([
    db
      .select({
        id: stockMovements.id,
        createdAt: stockMovements.createdAt,
        type: stockMovements.type,
        qtyDelta: stockMovements.qtyDelta,
        note: stockMovements.note,
        productName: products.name,
        productSku: products.skuCode,
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .where(where)
      .orderBy(desc(stockMovements.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .where(where),
  ]);
}

export default async function ArhivPage({ searchParams }: PageProps<"/arhiv">) {
  const sp = await searchParams;
  const view = sp.view === "products" ? "products" : "clients";
  const query = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [clientRows, [{ count: clientCount }]] =
    view === "clients" ? await loadClientArchive(query, offset) : [[], [{ count: 0 }]];
  const [productRows, [{ count: productCount }]] =
    view === "products" ? await loadProductArchive(query, offset) : [[], [{ count: 0 }]];

  const count = view === "clients" ? clientCount : productCount;

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Архив</h1>
        <p className="text-sm text-muted-foreground">
          Полная история — ничего не удаляется и не скрывается
        </p>
        <div className="flex gap-1 mt-3 border-b -mb-4">
          <Link
            href="/arhiv?view=clients"
            className={`px-4 py-2 text-sm border-b-2 ${
              view === "clients"
                ? "border-primary font-medium"
                : "border-transparent text-muted-foreground"
            }`}
          >
            По клиентам
          </Link>
          <Link
            href="/arhiv?view=products"
            className={`px-4 py-2 text-sm border-b-2 ${
              view === "products"
                ? "border-primary font-medium"
                : "border-transparent text-muted-foreground"
            }`}
          >
            По товарам
          </Link>
        </div>
      </div>

      <div className="px-6 pt-4">
        <ListSearchBox
          basePath="/arhiv"
          placeholder={
            view === "clients"
              ? "Поиск по клиенту..."
              : "Поиск по товару (артикул, название)..."
          }
        />
      </div>

      <main className="flex-1 p-6">
        {view === "clients" ? (
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
                {clientRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {query ? "Ничего не найдено" : "Продаж пока нет"}
                    </TableCell>
                  </TableRow>
                )}
                {clientRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {new Date(r.createdAt).toLocaleString("ru-RU")}
                    </TableCell>
                    <TableCell>{r.cashierName}</TableCell>
                    <TableCell>
                      {r.clientName ? (
                        <span>
                          {r.clientName}{" "}
                          <span className="text-xs text-muted-foreground font-mono">
                            {r.clientPhone}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
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
                        {r.hadStockConflict && <Badge variant="destructive">требует внимания</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Товар</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead className="text-right">Кол-во</TableHead>
                  <TableHead>Примечание</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {query ? "Ничего не найдено" : "Движений товара пока нет"}
                    </TableCell>
                  </TableRow>
                )}
                {productRows.map((r) => {
                  const meta = MOVEMENT_LABELS[r.type] ?? {
                    label: r.type,
                    variant: "secondary" as const,
                  };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {new Date(r.createdAt).toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell>
                        {r.productName}{" "}
                        <span className="text-xs text-muted-foreground font-mono">
                          {r.productSku}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          r.qtyDelta < 0 ? "text-destructive" : "text-emerald-600"
                        }`}
                      >
                        {r.qtyDelta > 0 ? "+" : ""}
                        {r.qtyDelta}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.note ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <PaginationControls
          page={page}
          totalPages={Math.max(1, Math.ceil(count / PAGE_SIZE))}
          total={count}
          basePath="/arhiv"
        />
      </main>
    </div>
  );
}
