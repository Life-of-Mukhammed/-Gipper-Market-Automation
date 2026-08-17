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
import { createClient, updateClient } from "./actions";

type Client = {
  id: string;
  fullName: string;
  phone: string;
  address: string | null;
  notes: string | null;
};

export function ClientFormDialog({ client }: { client?: Client }) {
  const isEdit = Boolean(client);
  const action = isEdit ? updateClient : createClient;
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
        {isEdit ? "Изменить" : "Добавить клиента"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Изменить клиента" : "Новый клиент"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {isEdit && <input type="hidden" name="id" value={client!.id} />}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">ФИО *</Label>
            <Input id="fullName" name="fullName" defaultValue={client?.fullName} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Телефон *</Label>
            <Input
              id="phone"
              name="phone"
              placeholder="+998 90 123 45 67"
              defaultValue={client?.phone}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Адрес</Label>
            <Input id="address" name="address" defaultValue={client?.address ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Заметки</Label>
            <Input id="notes" name="notes" defaultValue={client?.notes ?? ""} />
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
