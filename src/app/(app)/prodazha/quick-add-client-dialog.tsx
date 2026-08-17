"use client";

import { useState, useTransition } from "react";
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
import { createClientForPos } from "./actions";

export function QuickAddClientDialog({
  onCreated,
}: {
  onCreated: (client: { id: string; fullName: string; phone: string }) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createClientForPos(formData);
      if (result.client) {
        setError(null);
        setOpen(false);
        onCreated(result.client);
      } else {
        setError(result.error ?? "Ошибка");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        + Новый клиент
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый клиент</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pos-fullName">ФИО *</Label>
            <Input id="pos-fullName" name="fullName" required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pos-phone">Телефон (для WhatsApp) *</Label>
            <Input id="pos-phone" name="phone" placeholder="+998901234567" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Сохранение..." : "Сохранить и выбрать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
