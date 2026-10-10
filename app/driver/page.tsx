import type { Metadata } from "next";
import { Bus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import { DriverTripControls } from "@/components/DriverTripControls";
import { formatDateTime } from "@/lib/utils";
import { TripStatusBadge } from "@/components/StatusBadge";

export const metadata: Metadata = { title: "My trip" };

export default async function DriverPage() {
  const user = await requireRole("driver");
  const supabase = await createClient();

  const [busResult, activeTripResult, recentResult] = await Promise.all([
    supabase
      .from("buses")
      .select("*, route:routes(id, route_name, start_point, end_point)")
      .eq("driver_id", user.id)
      .maybeSingle(),
    supabase.from("trips").select("*").eq("driver_id", user.id).eq("status", "active").maybeSingle(),
    supabase
      .from("trips")
      .select("id, status, started_at, ended_at, bus:buses(bus_number)")
      .eq("driver_id", user.id)
      .neq("status", "active")
      .order("started_at", { ascending: false })
      .limit(5),
  ]);

  for (const r of [busResult, activeTripResult, recentResult]) {
    if (r.error) throw new Error(`Database query failed: ${r.error.message}`);
  }

  const bus = busResult.data;
  const activeTrip = activeTripResult.data;
  const recent = recentResult.data ?? [];

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 md:max-w-2xl">
      {!bus ? (
        <div className="py-6">
          <EmptyState icon={<Bus className="size-8" />} title="No bus assigned">
            Ask the transport office to assign you to a bus. This page updates when you reload it.
          </EmptyState>
        </div>
      ) : (
        <DriverTripControls
          bus={{ id: bus.id, bus_number: bus.bus_number, status: bus.status }}
          route={bus.route}
          activeTrip={activeTrip && activeTrip.bus_id === bus.id ? activeTrip : null}
          otherBusTrip={Boolean(activeTrip && activeTrip.bus_id !== bus.id)}
        />
      )}

      {recent.length > 0 ? (
        <section aria-labelledby="recent-heading" className="pb-[max(2rem,env(safe-area-inset-bottom))] pt-8">
          <h2 id="recent-heading" className="mb-2 text-base font-bold text-slate-900">
            Recent trips
          </h2>
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{t.bus?.bus_number ?? "Bus"}</p>
                  <p className="text-slate-600">{formatDateTime(t.started_at)}</p>
                </div>
                <TripStatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
