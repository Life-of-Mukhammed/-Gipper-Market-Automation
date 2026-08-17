"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function preset(days: number, offsetDays = 0) {
  const to = new Date();
  to.setDate(to.getDate() - offsetDays);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  return { from: toDateStr(from), to: toDateStr(to) };
}

const PRESETS = [
  { label: "Сегодня", range: () => preset(1) },
  { label: "Вчера", range: () => preset(1, 1) },
  { label: "Неделя", range: () => preset(7) },
  { label: "Месяц", range: () => preset(30) },
  { label: "Год", range: () => preset(365) },
];

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

  function applyPreset(range: { from: string; to: string }) {
    const params = new URLSearchParams(range);
    router.push(`/analiz?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const r = p.range();
          const active = r.from === from && r.to === to;
          return (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => applyPreset(r)}
            >
              {p.label}
            </Button>
          );
        })}
      </div>
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
    </div>
  );
}
