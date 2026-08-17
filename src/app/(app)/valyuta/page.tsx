import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { currencyRates } from "@/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RateForm } from "./rate-form";

export default async function ValyutaPage() {
  const rows = await db
    .select()
    .from(currencyRates)
    .orderBy(desc(currencyRates.effectiveDate))
    .limit(50);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Валюта</h1>
        <p className="text-sm text-muted-foreground">Курсы валют</p>
      </div>

      <main className="flex-1 p-6 flex flex-col gap-4">
        <RateForm />
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Валюта</TableHead>
                <TableHead className="text-right">Курс к сум</TableHead>
                <TableHead>Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Курсов пока нет
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.currencyCode}</TableCell>
                  <TableCell className="text-right">
                    {Number(r.rateToBase).toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell>{r.effectiveDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
