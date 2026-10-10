import Link from "next/link";
import { Bus } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import type { CurrentUser } from "@/lib/auth";
import { NavLinks, type NavItem } from "./NavLinks";

const NAV: Record<CurrentUser["profile"]["role"], NavItem[]> = {
  admin: [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/admin/buses", label: "Buses", icon: "bus" },
    { href: "/admin/routes", label: "Routes", icon: "route" },
    { href: "/admin/drivers", label: "Drivers", icon: "users" },
    { href: "/track", label: "Live map", icon: "map" },
  ],
  driver: [
    { href: "/driver", label: "My trip", icon: "bus" },
    { href: "/track", label: "Live map", icon: "map" },
  ],
  student: [{ href: "/track", label: "Buses", icon: "map" }],
};

const ROLE_LABEL = { admin: "Admin", driver: "Driver", student: "Student" } as const;

export function Navbar({ user }: { user: CurrentUser }) {
  const { role, full_name } = user.profile;
  const name = full_name || user.email || "Signed in";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex min-h-11 items-center gap-2 font-bold text-slate-900">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
            <Bus aria-hidden className="size-5" />
          </span>
          <span className="hidden sm:inline">Bus Tracker</span>
        </Link>
        <NavLinks
          items={NAV[role]}
          account={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="min-w-0 text-sm leading-tight">
                <p className="truncate font-medium text-slate-900">{name}</p>
                <p className="text-xs text-slate-500">{ROLE_LABEL[role]}</p>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="min-h-11 w-full rounded-xl px-3 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:w-auto"
                >
                  Sign out
                </button>
              </form>
            </div>
          }
        />
      </div>
    </header>
  );
}
