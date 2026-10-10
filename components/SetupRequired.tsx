import { Bus } from "lucide-react";
import { Card } from "@/components/ui";

/** Shown instead of the app when Supabase environment variables are missing. */
export function SetupRequired() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
      <Card className="p-6">
        <div className="flex items-center gap-2 text-brand-700">
          <Bus aria-hidden className="size-6" />
          <span className="font-semibold">College Bus Tracker</span>
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Supabase is not configured</h1>
        <p className="mt-2 text-sm text-slate-600">
          The app needs a Supabase project before it can sign users in or show buses.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>
            Copy <code className="rounded bg-slate-100 px-1">.env.example</code> to{" "}
            <code className="rounded bg-slate-100 px-1">.env.local</code>.
          </li>
          <li>
            Set <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.
          </li>
          <li>Run the SQL migration and restart the dev server. See README.md.</li>
        </ol>
      </Card>
    </main>
  );
}
