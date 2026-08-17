"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { confirmReceiving } from "./actions";

type Product = {
  id: string;
  skuCode: string;
  name: string;
  purchasePrice: string;
  salePrice: string;
};
type Supplier = { id: string; name: string };

type Line = { product: Product; qty: number; unitCost: number; salePrice: number };

export function ReceivingForm({
  products,
  suppliers,
}: {
  products: Product[];
  suppliers: Supplier[];
}) {
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const selectedSupplier = suppliers.find((s) => s.id === supplierId) ?? null;

  const supplierResults = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [supplierQuery, suppliers]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.skuCode.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, products]);

  function addLine(product: Product) {
    setLines((prev) => {
      if (prev.some((l) => l.product.id === product.id)) return prev;
      return [
        ...prev,
        { product, qty: 1, unitCost: Number(product.purchasePrice), salePrice: Number(product.salePrice) },
      ];
    });
    setSearch("");
    searchRef.current?.focus();
  }

  function updateLine(productId: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.product.id === productId ? { ...l, ...patch } : l)));
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.product.id !== productId));
  }

  const total = lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0);

  async function handleConfirm() {
    if (lines.length === 0) return;
    setSubmitting(true);
    const res = await confirmReceiving(
      supplierId || null,
      lines.map((l) => ({
        productId: l.product.id,
        qty: l.qty,
        unitCost: l.unitCost,
        salePrice: l.salePrice,
      })),
    );
    setSubmitting(false);
    if (res.ok) {
      toast.success("Приход оприходован, остатки обновлены");
      setLines([]);
      setSupplierId("");
      setSupplierQuery("");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Поставщик (необязательно)</label>
        {selectedSupplier ? (
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>{selectedSupplier.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSupplierId("");
                setSupplierQuery("");
              }}
            >
              Изменить
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Input
              placeholder="Найдите поставщика по названию..."
              value={supplierQuery}
              onChange={(e) => setSupplierQuery(e.target.value)}
            />
            {supplierResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
                {supplierResults.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSupplierId(s.id);
                      setSupplierQuery("");
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <Input
          ref={searchRef}
          placeholder="Найдите товар для добавления в приход..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-72 overflow-y-auto">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addLine(p)}
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between"
              >
                <span>{p.name}</span>
                <span className="text-xs text-muted-foreground font-mono">{p.skuCode}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Товар</TableHead>
              <TableHead className="text-right w-28">Кол-во</TableHead>
              <TableHead className="text-right w-32">Цена закупки</TableHead>
              <TableHead className="text-right w-32">Цена продажи</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Добавьте товары для оприходования
                </TableCell>
              </TableRow>
            )}
            {lines.map((l) => (
              <TableRow key={l.product.id}>
                <TableCell>{l.product.name}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    value={l.qty}
                    onChange={(e) => updateLine(l.product.id, { qty: Number(e.target.value) || 0 })}
                    className="w-20 text-center inline-block"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    value={l.unitCost}
                    onChange={(e) =>
                      updateLine(l.product.id, { unitCost: Number(e.target.value) || 0 })
                    }
                    className="w-24 text-center inline-block"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    value={l.salePrice}
                    onChange={(e) =>
                      updateLine(l.product.id, { salePrice: Number(e.target.value) || 0 })
                    }
                    className="w-24 text-center inline-block"
                  />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {(l.qty * l.unitCost).toLocaleString("ru-RU")}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => removeLine(l.product.id)}>
                    ✕
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Итого: {total.toLocaleString("ru-RU")}</div>
        <Button size="lg" disabled={lines.length === 0 || submitting} onClick={handleConfirm}>
          {submitting ? "Оприходование..." : "Оприходовать"}
        </Button>
      </div>
    </div>
  );
}
