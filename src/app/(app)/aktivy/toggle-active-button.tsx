"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleAssetActive } from "./actions";

export function ToggleActiveButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => toggleAssetActive(id, !isActive))}
    >
      {isActive ? "Списать" : "Вернуть"}
    </Button>
  );
}
