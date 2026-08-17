import Link from "next/link";
import { and, eq, gte, lte, ne, sql } from "drizzle-orm";
import {
  ShoppingCart,
  Package,
  LayoutGrid,
  Users,
  HandCoins,
  Truck,
  Wallet,
  Banknote,
  BarChart3,
  Archive,
  Tag,
  Coins,
  Building2,
  FileText,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/db/client";
import { debts, products, sales } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { DashboardClock } from "./dashboard-clock";

type Module = {
  title: string;
  href: string;
  icon: LucideIcon;
  ready: boolean;
};

type ModuleGroup = {
  title: string;
  modules: Module[];
};

const GROUPS: ModuleGroup[] = [
  {
    title: "Продажи и склад",
    modules: [
      { title: "Продажа", href: "/prodazha", icon: ShoppingCart, ready: true },
      { title: "Товар", href: "/tovar", icon: Package, ready: true },
      { title: "Ассортимент", href: "/assortiment", icon: LayoutGrid, ready: true },
      { title: "Поступление", href: "/postuplenie", icon: Truck, ready: true },
      { title: "Ценники", href: "/cenniki", icon: Tag, ready: true },
    ],
  },
  {
    title: "Клиенты и финансы",
    modules: [
      { title: "Клиенты", href: "/klienty", icon: Users, ready: true },
      { title: "Долги", href: "/dolgi", icon: HandCoins, ready: true },
      { title: "Деньги", href: "/dengi", icon: Banknote, ready: true },
      { title: "Отчёт по кассе", href: "/otchet-kassy", icon: Wallet, ready: true },
    ],
  },
  {
    title: "Аналитика и история",
    modules: [
      { title: "Анализ", href: "/analiz", icon: BarChart3, ready: true },
      { title: "Архив", href: "/arhiv", icon: Archive, ready: true },
    ],
  },
  {
    title: "Прочее",
    modules: [
      { title: "Валюта", href: "/valyuta", icon: Coins, ready: true },
      { title: "Активы", href: "/aktivy", icon: Building2, ready: true },
      { title: "Реквизиты", href: "/rekvizity", icon: FileText, ready: true },
      { title: "Справка", href: "/spravka", icon: HelpCircle, ready: true },
    ],
  },
];

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const [[todayRow], [{ openDebts }], [{ lowStock }]] = await Promise.all([
    db
      .select({
        revenue: sql<string>`coalesce(sum(${sales.total}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.status, "completed"),
          gte(sales.createdAt, startOfToday),
          lte(sales.createdAt, endOfToday),
        ),
      ),
    db
      .select({ openDebts: sql<string>`coalesce(sum(${debts.remainingBalance}), 0)` })
      .from(debts)
      .where(ne(debts.status, "paid")),
    db
      .select({ lowStock: sql<number>`count(*)::int` })
      .from(products)
      .where(and(eq(products.isActive, true), sql`${products.stockQty} <= ${products.minStockThreshold}`)),
  ]);

  const stats = [
    {
      label: "Продажи сегодня",
      value: `${Number(todayRow?.revenue ?? 0).toLocaleString("ru-RU")} сум`,
      sub: `${todayRow?.count ?? 0} продаж`,
    },
    {
      label: "Открытые долги",
      value: `${Number(openDebts).toLocaleString("ru-RU")} сум`,
      sub: "по всем клиентам",
      alert: Number(openDebts) > 0,
    },
    {
      label: "Заканчивается товар",
      value: String(lowStock),
      sub: "ниже минимального остатка",
      alert: lowStock > 0,
    },
  ];

  return (
    <main className="flex-1 p-4 sm:p-6 flex flex-col gap-6 sm:gap-8 bg-gradient-to-b from-muted/40 to-transparent">
      <DashboardClock userFirstName={user?.fullName.split(" ")[0] ?? ""} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className={s.alert ? "border-destructive/50" : undefined}>
            <CardContent className="py-4">
              <div className="text-sm text-muted-foreground">{s.label}</div>
              <div className={`text-2xl font-semibold ${s.alert ? "text-destructive" : ""}`}>
                {s.value}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              {group.title}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {group.modules.map((m) => {
                const Icon = m.icon;
                const card = (
                  <Card
                    className={
                      m.ready
                        ? "group hover:border-primary hover:shadow-sm transition-all cursor-pointer h-full"
                        : "opacity-60 h-full"
                    }
                  >
                    <CardContent className="flex flex-col items-start gap-3 py-4">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon className="size-5" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium leading-tight">{m.title}</span>
                        <Badge variant={m.ready ? "default" : "secondary"} className="w-fit">
                          {m.ready ? "готово" : "скоро"}
                        </Badge>
                      </div>
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
          </div>
        ))}
      </div>
    </main>
  );
}
