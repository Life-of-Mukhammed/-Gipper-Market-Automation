import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const MODULES = [
  { title: "Продажа", href: "/prodazha", ready: true },
  { title: "Товар", href: "/tovar", ready: true },
  { title: "Ассортимент", href: "/assortiment", ready: true },
  { title: "Клиенты", href: "/klienty", ready: true },
  { title: "Долги", href: "/dolgi", ready: true },
  { title: "Поступление", href: "/postuplenie", ready: true },
  { title: "Отчёт по кассе", href: "/otchet-kassy", ready: true },
  { title: "Анализ", href: "/analiz", ready: true },
  { title: "Архив", href: "/arhiv", ready: true },
  { title: "Ценники", href: "/cenniki", ready: true },
  { title: "Валюта", href: "/valyuta", ready: true },
  { title: "Реквизиты", href: "/rekvizity", ready: true },
  { title: "Справка", href: "/spravka", ready: true },
  { title: "Деньги", href: "/dengi", ready: false },
  { title: "Активы", href: "/aktivy", ready: false },
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
