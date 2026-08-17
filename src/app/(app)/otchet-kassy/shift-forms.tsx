"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { closeShift, openShift } from "./actions";

export function OpenShiftForm() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await openShift(null, formData);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Смена открыта");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 rounded-md border bg-background p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="openingBalance">Сумма в кассе на начало смены</Label>
        <Input id="openingBalance" name="openingBalance" type="number" step="0.01" defaultValue="0" required className="w-48" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Открытие..." : "Открыть смену"}
      </Button>
    </form>
  );
}

export function CloseShiftForm({ shiftId }: { shiftId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("shiftId", shiftId);
    startTransition(async () => {
      const result = await closeShift(null, formData);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Смена закрыта");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 rounded-md border bg-background p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="actualBalance">Сумма в кассе по факту</Label>
        <Input id="actualBalance" name="actualBalance" type="number" step="0.01" required className="w-48" />
      </div>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Закрытие..." : "Закрыть смену"}
      </Button>
    </form>
  );
}
