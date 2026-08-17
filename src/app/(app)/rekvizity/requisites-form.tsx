"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveRequisites } from "./actions";

type Requisites = {
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  phone: string | null;
  bankDetails: string | null;
  receiptFooterText: string | null;
};

export function RequisitesForm({ requisites }: { requisites: Requisites | null }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveRequisites(null, formData);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Сохранено");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-lg">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="legalName">Название организации</Label>
        <Input id="legalName" name="legalName" defaultValue={requisites?.legalName ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="taxId">ИНН</Label>
        <Input id="taxId" name="taxId" defaultValue={requisites?.taxId ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Адрес</Label>
        <Input id="address" name="address" defaultValue={requisites?.address ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Телефон</Label>
        <Input id="phone" name="phone" defaultValue={requisites?.phone ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bankDetails">Банковские реквизиты</Label>
        <Input id="bankDetails" name="bankDetails" defaultValue={requisites?.bankDetails ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="receiptFooterText">Текст внизу чека</Label>
        <Input
          id="receiptFooterText"
          name="receiptFooterText"
          defaultValue={requisites?.receiptFooterText ?? ""}
        />
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Сохранение..." : "Сохранить"}
      </Button>
    </form>
  );
}
