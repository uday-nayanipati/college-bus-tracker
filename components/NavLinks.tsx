"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bus, LayoutDashboard, Map, Menu, Route, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard,
  bus: Bus,
  route: Route,
  users: Users,
  map: Map,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

export function NavLinks({ items, account }: { items: NavItem[]; account: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  // Close the mobile menu after navigating.
  if (open && openedAt !== pathname) {
    setOpen(false);
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const links = items.map(({ href, label, icon }) => {
    const Icon = ICONS[icon];
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium",
          active ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100",
        )}
      >
        <Icon aria-hidden className="size-4" />
        {label}
      </Link>
    );
  });

  return (
    <>
      <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
        {links}
      </nav>
      <div className="ml-auto hidden md:block">{account}</div>

      <button
        type="button"
        className="ml-auto grid size-11 place-items-center rounded-xl text-slate-700 hover:bg-slate-100 md:hidden"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((o) => !o);
        }}
      >
        {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
      </button>

      {open ? (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full border-b border-slate-200 bg-white px-4 pb-4 pt-2 shadow-lg md:hidden"
        >
          <nav aria-label="Main" className="flex flex-col gap-1">
            {links}
          </nav>
          <div className="mt-3 border-t border-slate-200 pt-3">{account}</div>
        </div>
      ) : null}
    </>
  );
}
