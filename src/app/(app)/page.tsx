import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const MODULES = [
  { title: "Продажа", href: "/prodazha", ready: true },
  { title: "Товар", href: "/tovar", ready: true },
  { title: "Ассортимент", href: "/assortiment", ready: true },
  { title: "Поступление", href: "/postuplenie", ready: false },
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

export default function DashboardPage() {
  return (
    <main className="flex-1 p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {MODULES.map((m) => {
          const card = (
            <Card className={m.ready ? "hover:border-primary transition-colors" : "opacity-70"}>
              <CardContent className="flex flex-col items-start gap-2 py-4">
                <span className="font-medium">{m.title}</span>
                <Badge variant={m.ready ? "default" : "secondary"}>
                  {m.ready ? "готово" : "скоро"}
                </Badge>
              </CardContent>
            </Card>
          );
          return m.ready ? (
            <Link key={m.href} href={m.href}>
              {card}
            </Link>
          ) : (
            <div key={m.href}>{card}</div>
          );
        })}
      </div>
    </main>
  );
}
