"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordExpense } from "./actions";

const CATEGORIES = ["Аренда", "Зарплата", "Коммунальные", "Транспорт", "Закупка", "Прочее"];

export function ExpenseForm() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await recordExpense(null, formData);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Расход записан");
        (e.target as HTMLFormElement).reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-md border bg-background p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">Сумма расхода</Label>
        <Input id="amount" name="amount" type="number" step="0.01" min="0" className="w-40" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category">Категория</Label>
        <Input id="category" name="category" list="expense-categories" className="w-48" required />
        <datalist id="expense-categories">
          {CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1.5 flex-1 min-w-40">
        <Label htmlFor="note">Заметка</Label>
        <Input id="note" name="note" />
      </div>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Запись..." : "Записать расход"}
      </Button>
    </form>
  );
}
