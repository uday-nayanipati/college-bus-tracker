import type { Metadata } from "next";
import { listBuses, listLocations, listRoutes } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { FleetList } from "@/components/FleetList";

export const metadata: Metadata = { title: "Buses" };

export default async function TrackPage() {
  const supabase = await createClient();
  const [buses, routes, locations, trips] = await Promise.all([
    listBuses(),
    listRoutes(),
    listLocations(),
    supabase.from("trips").select("*").eq("status", "active"),
  ]);
  if (trips.error) throw new Error(`Database query failed: ${trips.error.message}`);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
      <FleetList
        buses={buses
          .filter((b) => b.status !== "inactive")
          .map((b) => ({ id: b.id, bus_number: b.bus_number, status: b.status, route: b.route }))}
        routes={routes.map((r) => ({ id: r.id, route_name: r.route_name }))}
        locations={locations}
        trips={trips.data}
      />
    </main>
  );
}
