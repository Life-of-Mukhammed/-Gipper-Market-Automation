"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushQuery(q: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (q) {
      params.set("q", q);
    } else {
      params.delete("q");
    }
    router.replace(`/assortiment?${params.toString()}`);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Input
      autoFocus
      placeholder="Поиск по артикулу, штрихкоду или названию..."
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        setValue(v);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => pushQuery(v), 300);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          if (timerRef.current) clearTimeout(timerRef.current);
          pushQuery(value);
        }
      }}
      className="max-w-md"
    />
  );
}
