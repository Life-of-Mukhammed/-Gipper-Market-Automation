"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { REMINDER_TYPES, REMINDER_TYPE_LABELS, type ReminderType } from "@/lib/notifications/whatsapp/types";

export type ReminderRow = {
  id: string;
  reminderType: ReminderType;
  scheduledDate: string;
  status: "pending" | "sent" | "failed";
  sentAt: string | null;
  errorMessage: string | null;
};

const STATUS_LABELS: Record<ReminderRow["status"], string> = {
  pending: "ожидает",
  sent: "отправлено",
  failed: "ошибка",
};

export function WhatsappRemindersPanel({
  debtId,
  reminders,
  canTest,
}: {
  debtId: string;
  reminders: ReminderRow[];
  canTest: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [testType, setTestType] = useState<ReminderType>("due_date");

  function sendTest() {
    startTransition(async () => {
      const res = await fetch("/api/whatsapp/test-debt-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debtId, reminderType: testType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Не удалось отправить сообщение");
      } else {
        toast.success("Тестовое напоминание отправлено");
      }
    });
  }

  return (
    <div>
      <h2 className="font-medium mb-2">WhatsApp напоминания</h2>
      <div className="rounded-md border bg-background p-4 flex flex-col gap-3">
        {reminders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Напоминаний пока не было</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-sm flex-wrap">
                <span className="text-muted-foreground">{REMINDER_TYPE_LABELS[r.reminderType]}</span>
                <span className="font-mono text-xs text-muted-foreground">{r.scheduledDate}</span>
                <Badge variant={r.status === "sent" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                  {STATUS_LABELS[r.status]}
                </Badge>
                {r.sentAt && (
                  <span className="text-xs text-muted-foreground">{new Date(r.sentAt).toLocaleString("ru-RU")}</span>
                )}
                {r.errorMessage && <span className="text-xs text-destructive">{r.errorMessage}</span>}
              </div>
            ))}
          </div>
        )}

        {canTest && (
          <div className="flex items-center gap-2 border-t pt-3 flex-wrap">
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value as ReminderType)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {REMINDER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REMINDER_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={sendTest}>
              {pending ? "Отправка..." : "Тестовое напоминание"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
