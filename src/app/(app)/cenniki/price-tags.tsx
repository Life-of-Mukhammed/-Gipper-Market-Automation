"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Product = { id: string; skuCode: string; name: string; salePrice: string };

export function PriceTags({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedProducts = products.filter((p) => selected.has(p.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelected(new Set(products.map((p) => p.id)))}
          >
            Выбрать все
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
            Снять выбор
          </Button>
        </div>
        <Button disabled={selected.size === 0} onClick={() => window.print()}>
          Печать ({selected.size})
        </Button>
      </div>

      <div className="rounded-md border bg-background divide-y print:hidden">
        {products.map((p) => (
          <label key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selected.has(p.id)}
              onChange={() => toggle(p.id)}
            />
            <span className="flex-1">{p.name}</span>
            <span className="text-xs text-muted-foreground font-mono">{p.skuCode}</span>
            <span className="font-medium w-24 text-right">{p.salePrice}</span>
          </label>
        ))}
      </div>

      <div className="hidden print:grid print:grid-cols-3 print:gap-2">
        {selectedProducts.map((p) => (
          <div key={p.id} className="border rounded p-3 flex flex-col gap-1">
            <div className="text-sm">{p.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{p.skuCode}</div>
            <div className="text-lg font-bold">{Number(p.salePrice).toLocaleString("ru-RU")} сум</div>
          </div>
        ))}
      </div>
    </div>
  );
}
