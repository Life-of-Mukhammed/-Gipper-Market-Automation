import { db } from "@/db/client";
import { companyRequisites } from "@/db/schema";
import { RequisitesForm } from "./requisites-form";

export default async function RekvizityPage() {
  const [requisites] = await db.select().from(companyRequisites).limit(1);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Реквизиты</h1>
        <p className="text-sm text-muted-foreground">Данные организации, отображаемые в чеках</p>
      </div>

      <main className="flex-1 p-6">
        <RequisitesForm requisites={requisites ?? null} />
      </main>
    </div>
  );
}
