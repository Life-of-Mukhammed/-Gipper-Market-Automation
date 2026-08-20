"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function StockFilterToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checked = searchParams.get("inStock") !== "0";

  function toggle(next: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.delete("inStock");
    } else {
      params.set("inStock", "0");
    }
    params.set("page", "1");
    router.push(`/tovar?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Switch id="in-stock-filter" checked={checked} onCheckedChange={toggle} />
      <Label htmlFor="in-stock-filter" className="text-sm font-normal">
        Только в наличии
      </Label>
    </div>
  );
}
