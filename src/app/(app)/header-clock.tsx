"use client";

import { useEffect, useState } from "react";

export function HeaderClock() {
  // Starts as null so the very first client render matches the server's
  // (which has no access to the real time) — avoids a hydration mismatch.
  // The real clock kicks in a moment later via the effect below.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the real clock can only be read post-mount (SSR has no wall clock); this is the correction step, not a derivable value
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const dateStr = now.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="hidden sm:flex flex-col items-end leading-tight text-right">
      <span className="text-xs text-muted-foreground capitalize">{dateStr}</span>
      <span className="text-sm font-medium font-mono tabular-nums">{timeStr}</span>
    </div>
  );
}
