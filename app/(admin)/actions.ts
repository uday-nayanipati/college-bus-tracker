"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/utils";
import type { BusStatus } from "@/types/database";

// Every action re-checks the admin role on the server. RLS enforces the same
// rules in the database, so a forged request without admin rights still fails.

export type ActionState = { ok?: boolean; error?: string; message?: string };

const BUS_STATUSES: BusStatus[] = ["active", "maintenance", "inactive"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalId(value: string): string | null | undefined {
  if (!value) return null;
  return UUID_RE.test(value) ? value : undefined;
}

function revalidateAdmin() {
  revalidatePath("/dashboard");
  revalidatePath("/admin", "layout");
  revalidatePath("/track", "layout");
  revalidatePath("/driver");
}

// --- Buses -----------------------------------------------------------------

export async function saveBus(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");

  const id = optionalId(str(formData, "id"));
  const busNumber = str(formData, "bus_number").toUpperCase();
  const capacity = Number(str(formData, "capacity"));
  const status = str(formData, "status") as BusStatus;
  const routeId = optionalId(str(formData, "route_id"));

  if (id === undefined || routeId === undefined) return { error: "Invalid request." };
  if (!busNumber || busNumber.length > 40) return { error: "Bus number is required (max 40 characters)." };
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) {
    return { error: "Capacity must be a whole number between 1 and 200." };
  }
  if (!BUS_STATUSES.includes(status)) return { error: "Choose a valid status." };

  const supabase = await createClient();
  const values = { bus_number: busNumber, capacity, status, route_id: routeId };
  const { error } = id
    ? await supabase.from("buses").update(values).eq("id", id).select("id").single()
    : await supabase.from("buses").insert(values).select("id").single();

  if (error) {
    return {
      error:
        error.code === "23505"
          ? `Bus number ${busNumber} already exists.`
          : friendlyDbError(error),
    };
  }
  revalidateAdmin();
  return { ok: true, message: id ? "Bus updated." : "Bus added." };
}

export async function deleteBus(id: string): Promise<ActionState> {
  await requireRole("admin");
  if (!UUID_RE.test(id)) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error, count } = await supabase.from("buses").delete({ count: "exact" }).eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "This bus has trip history and cannot be deleted. Set its status to Inactive instead."
          : friendlyDbError(error),
    };
  }
  if (!count) return { error: "Bus not found." };
  revalidateAdmin();
  return { ok: true, message: "Bus deleted." };
}

// --- Routes ----------------------------------------------------------------

export async function saveRoute(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");

  const id = optionalId(str(formData, "id"));
  const routeName = str(formData, "route_name");
  const startPoint = str(formData, "start_point");
  const endPoint = str(formData, "end_point");

  if (id === undefined) return { error: "Invalid request." };
  if (!routeName || routeName.length > 120) return { error: "Route name is required (max 120 characters)." };
  if (!startPoint || startPoint.length > 200) return { error: "Start point is required." };
  if (!endPoint || endPoint.length > 200) return { error: "End point is required." };

  const supabase = await createClient();
  const values = { route_name: routeName, start_point: startPoint, end_point: endPoint };
  const { error } = id
    ? await supabase.from("routes").update(values).eq("id", id).select("id").single()
    : await supabase.from("routes").insert(values).select("id").single();

  if (error) {
    return {
      error: error.code === "23505" ? `A route named “${routeName}” already exists.` : friendlyDbError(error),
    };
  }
  revalidateAdmin();
  return { ok: true, message: id ? "Route updated." : "Route created." };
}

export async function deleteRoute(id: string): Promise<ActionState> {
  await requireRole("admin");
  if (!UUID_RE.test(id)) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error, count } = await supabase.from("routes").delete({ count: "exact" }).eq("id", id);
  if (error) return { error: friendlyDbError(error) };
  if (!count) return { error: "Route not found." };
  revalidateAdmin();
  return { ok: true, message: "Route deleted. Buses on it now have no route." };
}

// --- Drivers ---------------------------------------------------------------

export async function setUserRole(userId: string, role: "driver" | "student"): Promise<ActionState> {
  await requireRole("admin");
  if (!UUID_RE.test(userId) || (role !== "driver" && role !== "student")) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId).select("id").single();
  if (error) return { error: friendlyDbError(error) };
  revalidateAdmin();
  return { ok: true, message: role === "driver" ? "User is now a driver." : "Driver access removed." };
}

export async function assignDriver(driverId: string, busId: string | null): Promise<ActionState> {
  await requireRole("admin");
  if (!UUID_RE.test(driverId) || (busId !== null && !UUID_RE.test(busId))) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_driver", { p_driver_id: driverId, p_bus_id: busId });
  if (error) return { error: friendlyDbError(error) };
  revalidateAdmin();
  return { ok: true, message: busId ? "Driver assigned." : "Driver unassigned." };
}

// --- Trips -----------------------------------------------------------------

export async function cancelTrip(tripId: string): Promise<ActionState> {
  await requireRole("admin");
  if (!UUID_RE.test(tripId)) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("end_trip", { p_trip_id: tripId });
  if (error) return { error: friendlyDbError(error) };
  revalidateAdmin();
  return { ok: true, message: "Trip cancelled." };
}
