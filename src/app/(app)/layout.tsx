import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "./logout-button";
import { MobileNav } from "./mobile-nav";
import { HeaderClock } from "./header-clock";

const NAV_LINKS = [
  { title: "Продажа", href: "/prodazha" },
  { title: "Товар", href: "/tovar" },
  { title: "Ассортимент", href: "/assortiment" },
  { title: "Клиенты", href: "/klienty" },
  { title: "Долги", href: "/dolgi" },
];

const MORE_LINKS = [
  { title: "Поступление", href: "/postuplenie" },
  { title: "Деньги", href: "/dengi" },
  { title: "Отчёт по кассе", href: "/otchet-kassy" },
  { title: "Анализ", href: "/analiz" },
  { title: "Архив", href: "/arhiv" },
  { title: "Ценники", href: "/cenniki" },
  { title: "Валюта", href: "/valyuta" },
  { title: "Активы", href: "/aktivy" },
  { title: "Реквизиты", href: "/rekvizity" },
  { title: "Справка", href: "/spravka" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const userLabel = `${user.fullName} · ${user.role === "admin" ? "Администратор" : "Кассир"}`;

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b bg-background px-3 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <MobileNav links={[...NAV_LINKS, ...MORE_LINKS]} userLabel={userLabel} />
          <Link href="/" className="font-semibold whitespace-nowrap truncate">
            СантехТорг CRM
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <HeaderClock />
          <LogoutButton />
        </div>
      </header>
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
