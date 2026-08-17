"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setProductActive } from "./actions";

export function ToggleActiveButton({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => setProductActive(id, !isActive))}
    >
      {isActive ? "Скрыть" : "Вернуть"}
    </Button>
  );
}
