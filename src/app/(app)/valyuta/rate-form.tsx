"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCurrencyRate } from "./actions";

export function RateForm() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addCurrencyRate(null, formData);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Курс добавлен");
        (e.target as HTMLFormElement).reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 rounded-md border bg-background p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currencyCode">Валюта</Label>
        <Input id="currencyCode" name="currencyCode" placeholder="USD" className="w-24" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rateToBase">Курс к сум</Label>
        <Input id="rateToBase" name="rateToBase" type="number" step="0.0001" className="w-32" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="effectiveDate">Дата</Label>
        <Input
          id="effectiveDate"
          name="effectiveDate"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Добавление..." : "Добавить"}
      </Button>
    </form>
  );
}
