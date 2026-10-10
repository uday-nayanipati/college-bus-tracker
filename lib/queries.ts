import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Bus, BusLocation, Profile, Route, Trip } from "@/types/database";

// All reads go through the user's own session, so RLS decides what is visible.

export type BusWithRelations = Bus & {
  route: Pick<Route, "id" | "route_name" | "start_point" | "end_point"> | null;
  driver: Pick<Profile, "id" | "full_name"> | null;
};

export type TripWithRelations = Trip & {
  bus: Pick<Bus, "id" | "bus_number"> | null;
  driver: Pick<Profile, "id" | "full_name"> | null;
  route: Pick<Route, "id" | "route_name"> | null;
};

/** Thrown errors are caught by the nearest error.tsx boundary. */
function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(`Database query failed: ${result.error.message}`);
  return result.data as T;
}

export async function listBuses(): Promise<BusWithRelations[]> {
  const supabase = await createClient();
  const result = await supabase
    .from("buses")
    .select(
      "*, route:routes(id, route_name, start_point, end_point), driver:profiles!buses_driver_id_fkey(id, full_name)",
    )
    .order("bus_number");
  return check(result);
}

export async function listRoutes(): Promise<Route[]> {
  const supabase = await createClient();
  return check(await supabase.from("routes").select("*").order("route_name"));
}

/** Admin only (RLS returns just the caller's own profile otherwise). */
export async function listProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  return check(await supabase.from("profiles").select("*").order("full_name"));
}

const TRIP_SELECT =
  "*, bus:buses(id, bus_number), driver:profiles!trips_driver_id_fkey(id, full_name), route:routes(id, route_name)";

export async function listTrips(filter: "active" | "ended" | "all", limit = 50): Promise<TripWithRelations[]> {
  const supabase = await createClient();
  let query = supabase.from("trips").select(TRIP_SELECT).order("started_at", { ascending: false }).limit(limit);
  if (filter === "active") query = query.eq("status", "active");
  if (filter === "ended") query = query.neq("status", "active");
  return check(await query);
}

export async function listLocations(): Promise<BusLocation[]> {
  const supabase = await createClient();
  return check(await supabase.from("bus_locations").select("*"));
}

export async function countRows(table: "buses" | "routes" | "trips" | "profiles", filter?: [string, string]) {
  const supabase = await createClient();
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) query = query.eq(filter[0], filter[1]);
  const { count, error } = await query;
  if (error) throw new Error(`Database query failed: ${error.message}`);
  return count ?? 0;
}
