import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LogoutButton } from "./logout-button";

const MODULES = [
  { title: "Продажа", href: "/prodazha", ready: false },
  { title: "Поступление", href: "/postuplenie", ready: false },
  { title: "Ассортимент", href: "/assortiment", ready: false },
  { title: "Товар", href: "/tovar", ready: false },
  { title: "Деньги", href: "/dengi", ready: false },
  { title: "Отчёт по кассе", href: "/otchet-kassy", ready: false },
  { title: "Клиенты", href: "/klienty", ready: false },
  { title: "Долги", href: "/dolgi", ready: false },
  { title: "Анализ", href: "/analiz", ready: false },
  { title: "Архив", href: "/arhiv", ready: false },
  { title: "Ценники", href: "/cenniki", ready: false },
  { title: "Валюта", href: "/valyuta", ready: false },
  { title: "Активы", href: "/aktivy", ready: false },
  { title: "Реквизиты", href: "/rekvizity", ready: false },
  { title: "Справка", href: "/spravka", ready: false },
];

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b bg-background px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">СантехТорг CRM</h1>
          <p className="text-sm text-muted-foreground">
            {user.fullName} · {user.role === "admin" ? "Администратор" : "Кассир"}
          </p>
        </div>
        <LogoutButton />
      </header>

      <main className="flex-1 p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {MODULES.map((m) => (
            <Card key={m.href} className="opacity-80">
              <CardContent className="flex flex-col items-start gap-2 py-4">
                <span className="font-medium">{m.title}</span>
                <Badge variant={m.ready ? "default" : "secondary"}>
                  {m.ready ? "готово" : "скоро"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
