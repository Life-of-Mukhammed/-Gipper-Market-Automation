"use client";

import { useEffect, useState } from "react";

export function DashboardClock({ userFirstName }: { userFirstName: string }) {
  // Same hydration-safe pattern as header-clock.tsx: start null so the
  // first client render matches the server (no real time available there).
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the real clock can only be read post-mount (SSR has no wall clock); this is the correction step, not a derivable value
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateStr = now?.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = now?.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl border bg-card px-4 py-3 sm:px-5 sm:py-4">
      <div>
        <div className="text-lg font-semibold">Добро пожаловать, {userFirstName}</div>
        <div className="text-sm text-muted-foreground capitalize">{dateStr ?? " "}</div>
      </div>
      <div className="text-2xl font-mono font-semibold tabular-nums">{timeStr ?? "--:--:--"}</div>
    </div>
  );
}
