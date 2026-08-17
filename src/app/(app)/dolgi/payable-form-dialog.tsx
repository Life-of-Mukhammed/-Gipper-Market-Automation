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
import { createPayable } from "./actions";

export function PayableFormDialog() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createPayable(null, formData);
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
      <DialogTrigger render={<Button size="sm" />}>Добавить долг</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый долг (мы должны)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="creditorName">Кому должны *</Label>
            <Input id="creditorName" name="creditorName" placeholder="Поставщик, банк..." required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Телефон</Label>
            <Input id="phone" name="phone" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Сумма *</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dueDate">Срок оплаты</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Заметка</Label>
            <Input id="note" name="note" />
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
