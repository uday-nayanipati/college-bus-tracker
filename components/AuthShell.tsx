import Link from "next/link";
import type { ReactNode } from "react";
import { Bus } from "lucide-react";
import { Card } from "@/components/ui";

export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <Link href="/" className="mb-6 flex min-h-11 items-center gap-2 self-center font-bold text-slate-900">
        <span className="grid size-9 place-items-center rounded-lg bg-brand-600 text-white">
          <Bus aria-hidden className="size-5" />
        </span>
        College Bus Tracker
      </Link>
      <Card className="p-5 sm:p-6">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <div className="mt-4">{children}</div>
      </Card>
      {footer ? <div className="mt-4 text-center text-sm text-slate-600">{footer}</div> : null}
    </main>
  );
}
