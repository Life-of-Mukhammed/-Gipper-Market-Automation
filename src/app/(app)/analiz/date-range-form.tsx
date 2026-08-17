"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DateRangeForm({ from, to }: { from: string; to: string }) {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams({
      from: String(fd.get("from")),
      to: String(fd.get("to")),
    });
    router.push(`/analiz?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">С</label>
        <Input name="from" type="date" defaultValue={from} className="w-40" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">По</label>
        <Input name="to" type="date" defaultValue={to} className="w-40" />
      </div>
      <Button type="submit" variant="outline">
        Показать
      </Button>
    </form>
  );
}
