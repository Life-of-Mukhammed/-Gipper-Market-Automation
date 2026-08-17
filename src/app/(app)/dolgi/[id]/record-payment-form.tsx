"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordDebtPayment } from "../actions";

export function RecordPaymentForm({ debtId, remainingBalance }: { debtId: string; remainingBalance: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("debtId", debtId);
    startTransition(async () => {
      const result = await recordDebtPayment(null, formData);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Платёж записан");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Сумма платежа</label>
        <Input
          name="amount"
          type="number"
          step="0.01"
          min="0"
          max={remainingBalance}
          placeholder={remainingBalance}
          required
          className="w-40"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Запись..." : "Принять оплату"}
      </Button>
    </form>
  );
}
