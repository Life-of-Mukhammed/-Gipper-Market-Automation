import { desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { assets } from "@/db/schema";
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
import { AssetForm } from "./asset-form";
import { ToggleActiveButton } from "./toggle-active-button";

export default async function AktivyPage() {
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(assets).orderBy(desc(assets.createdAt)),
    db
      .select({ total: sql<string>`coalesce(sum(${assets.value}) filter (where ${assets.isActive}), 0)` })
      .from(assets),
  ]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Активы</h1>
        <p className="text-sm text-muted-foreground">Оборудование, мебель и другое имущество</p>
      </div>

      <main className="flex-1 p-6 flex flex-col gap-6">
        <Card className="w-fit">
          <CardContent className="py-4">
            <div className="text-sm text-muted-foreground">Общая стоимость активов</div>
            <div className="text-2xl font-semibold">{Number(total).toLocaleString("ru-RU")} сум</div>
          </CardContent>
        </Card>

        <AssetForm />

        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Дата покупки</TableHead>
                <TableHead className="text-right">Стоимость</TableHead>
                <TableHead>Заметка</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Активов пока нет
                  </TableCell>
                </TableRow>
              )}
              {rows.map((a) => (
                <TableRow key={a.id} className={!a.isActive ? "opacity-50" : ""}>
                  <TableCell>{a.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.category ?? "—"}</TableCell>
                  <TableCell className="text-sm">{a.purchaseDate ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">
                    {Number(a.value).toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.note ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={a.isActive ? "default" : "secondary"}>
                      {a.isActive ? "активен" : "списан"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ToggleActiveButton id={a.id} isActive={a.isActive} />
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
