"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createProduct, updateProduct } from "./actions";

type Product = {
  id: string;
  skuCode: string;
  barcode: string | null;
  name: string;
  unit: string;
  category: string | null;
  purchasePrice: string;
  salePrice: string;
  stockQty: number;
  minStockThreshold: number;
};

export function ProductFormDialog({ product }: { product?: Product }) {
  const isEdit = Boolean(product);
  const action = isEdit ? updateProduct : createProduct;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(null, formData);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setError(null);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={isEdit ? "outline" : "default"} size={isEdit ? "sm" : "default"} />
        }
      >
        {isEdit ? "Изменить" : "Добавить товар"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Изменить товар" : "Новый товар"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {isEdit && <input type="hidden" name="id" value={product!.id} />}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="skuCode">Артикул *</Label>
              <Input
                id="skuCode"
                name="skuCode"
                defaultValue={product?.skuCode}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="barcode">Штрихкод</Label>
              <Input id="barcode" name="barcode" defaultValue={product?.barcode ?? ""} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Наименование *</Label>
            <Input id="name" name="name" defaultValue={product?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit">Ед. изм.</Label>
              <Input id="unit" name="unit" defaultValue={product?.unit ?? "шт"} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Категория</Label>
              <Input id="category" name="category" defaultValue={product?.category ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchasePrice">Цена закупки</Label>
              <Input
                id="purchasePrice"
                name="purchasePrice"
                inputMode="decimal"
                defaultValue={product?.purchasePrice ?? "0"}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="salePrice">Цена продажи</Label>
              <Input
                id="salePrice"
                name="salePrice"
                inputMode="decimal"
                defaultValue={product?.salePrice ?? "0"}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stockQty">Остаток</Label>
              <Input
                id="stockQty"
                name="stockQty"
                type="number"
                defaultValue={product?.stockQty ?? 0}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minStockThreshold">Мин. остаток</Label>
              <Input
                id="minStockThreshold"
                name="minStockThreshold"
                type="number"
                defaultValue={product?.minStockThreshold ?? 0}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
