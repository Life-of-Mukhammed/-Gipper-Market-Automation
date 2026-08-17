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
import { recordPayablePayment } from "./actions";

export function PayablePaymentDialog({
  payableId,
  remainingBalance,
}: {
  payableId: string;
  remainingBalance: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("payableId", payableId);
    startTransition(async () => {
      const result = await recordPayablePayment(null, formData);
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
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Оплатить</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Оплата долга</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payable-amount">Сумма (остаток {remainingBalance})</Label>
            <Input
              id="payable-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              max={remainingBalance}
              required
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Запись..." : "Оплатить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
