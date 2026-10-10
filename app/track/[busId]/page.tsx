import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BusTracker } from "@/components/BusTracker";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Live bus" };

export default async function TrackBusPage({ params }: PageProps<"/track/[busId]">) {
  const { busId } = await params;
  if (!UUID_RE.test(busId)) notFound();

  const supabase = await createClient();
  const [bus, location, trip] = await Promise.all([
    supabase
      .from("buses")
      .select("id, bus_number, status, route:routes(route_name, start_point, end_point)")
      .eq("id", busId)
      .maybeSingle(),
    supabase.from("bus_locations").select("*").eq("bus_id", busId).maybeSingle(),
    supabase.from("trips").select("*").eq("bus_id", busId).eq("status", "active").maybeSingle(),
  ]);

  for (const r of [bus, location, trip]) {
    if (r.error) throw new Error(`Database query failed: ${r.error.message}`);
  }
  // Not found, or hidden from this user by RLS.
  if (!bus.data) notFound();

  return (
    <BusTracker
      bus={{ id: bus.data.id, bus_number: bus.data.bus_number, status: bus.data.status }}
      route={bus.data.route}
      initialLocation={location.data}
      initialTrip={trip.data}
    />
  );
}
