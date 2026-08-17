"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LogoutButton } from "./logout-button";

type NavLink = { title: string; href: string };

export function MobileNav({
  links,
  userLabel,
}: {
  links: NavLink[];
  userLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon-sm" className="md:hidden" />}>
        <MenuIcon />
        <span className="sr-only">Меню</span>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col w-4/5">
        <SheetHeader className="border-b">
          <SheetTitle>СантехТорг CRM</SheetTitle>
          <p className="text-sm text-muted-foreground">{userLabel}</p>
        </SheetHeader>
        <nav className="flex-1 flex flex-col gap-1 px-2 overflow-y-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`rounded-md px-3 py-2.5 text-sm transition-colors ${
                pathname === link.href
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {link.title}
            </Link>
          ))}
        </nav>
        <div className="border-t p-4">
          <LogoutButton />
        </div>
      </SheetContent>
    </Sheet>
  );
}
