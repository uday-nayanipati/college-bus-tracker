"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MapPin } from "lucide-react";
import { cancelTrip } from "@/app/(admin)/actions";
import type { TripWithRelations } from "@/lib/queries";
import type { BusLocation } from "@/types/database";
import { useNow } from "@/lib/use-now";
import { formatDateTime, formatDuration, formatRelative, locationFreshness } from "@/lib/utils";
import { ConfirmDialog } from "./Modal";
import { FreshnessBadge, TripStatusBadge } from "./StatusBadge";
import { Alert, Card, EmptyState } from "./ui";

export function TripsTable({
  trips,
  locations,
  filter,
}: {
  trips: TripWithRelations[];
  locations: BusLocation[];
  filter: "active" | "ended" | "all";
}) {
  const now = useNow();
  const router = useRouter();
  const [cancelling, setCancelling] = useState<TripWithRelations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const locationByBus = new Map(locations.map((l) => [l.bus_id, l]));

  if (trips.length === 0) {
    return (
      <EmptyState title={filter === "active" ? "No active trips" : "No trips yet"}>
        {filter === "active"
          ? "Trips appear here when a driver presses Start Trip."
          : "Trips appear here once drivers start using the app."}
      </EmptyState>
    );
  }

  const rows = trips.map((trip) => {
    const loc = trip.status === "active" ? locationByBus.get(trip.bus_id) : undefined;
    const freshness = trip.status === "active" && now ? locationFreshness(loc?.updated_at, now) : null;
    return { trip, loc, freshness };
  });

  const confirmCancel = () => {
    if (!cancelling) return;
    startTransition(async () => {
      const result = await cancelTrip(cancelling.id);
      setCancelling(null);
      setError(result.error ?? null);
      router.refresh();
    });
  };

  return (
    <>
      {error ? (
        <Alert tone="error" className="mb-3">
          {error}
        </Alert>
      ) : null}

      {/* Phones: cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map(({ trip, loc, freshness }) => (
          <li key={trip.id}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{trip.bus?.bus_number ?? "Unknown bus"}</p>
                  <p className="truncate text-sm text-slate-600">{trip.route?.route_name ?? "No route"}</p>
                </div>
                <TripStatusBadge status={trip.status} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <dt className="text-slate-500">Driver</dt>
                <dd className="truncate text-slate-900">{trip.driver?.full_name || "—"}</dd>
                <dt className="text-slate-500">Started</dt>
                <dd className="text-slate-900">{formatDateTime(trip.started_at)}</dd>
                <dt className="text-slate-500">Duration</dt>
                <dd className="text-slate-900">{now ? formatDuration(trip.started_at, trip.ended_at, now) : "—"}</dd>
                {trip.status === "active" ? (
                  <>
                    <dt className="text-slate-500">Location</dt>
                    <dd className="text-slate-900">
                      {freshness ? <FreshnessBadge freshness={freshness} /> : null}
                      {loc && now ? <span className="ml-1 text-xs text-slate-500">{formatRelative(loc.updated_at, now)}</span> : null}
                    </dd>
                  </>
                ) : null}
              </dl>
              {trip.status === "active" ? (
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/track/${trip.bus_id}`}
                    className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-100 hover:bg-brand-50"
                  >
                    <MapPin aria-hidden className="size-4" /> View on map
                  </Link>
                  <button
                    type="button"
                    onClick={() => setCancelling(trip)}
                    className="min-h-11 rounded-xl px-3 text-sm font-semibold text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50"
                  >
                    Cancel trip
                  </button>
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

      {/* Tablets and up: table that scrolls inside its own container */}
      <Card className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Bus</th>
              <th scope="col" className="px-4 py-3">Route</th>
              <th scope="col" className="px-4 py-3">Driver</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Started</th>
              <th scope="col" className="px-4 py-3">Duration</th>
              <th scope="col" className="px-4 py-3">Location</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ trip, loc, freshness }) => (
              <tr key={trip.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{trip.bus?.bus_number ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{trip.route?.route_name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{trip.driver?.full_name || "—"}</td>
                <td className="px-4 py-3"><TripStatusBadge status={trip.status} /></td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(trip.started_at)}</td>
                <td className="px-4 py-3 text-slate-700">{now ? formatDuration(trip.started_at, trip.ended_at, now) : "—"}</td>
                <td className="px-4 py-3">
                  {freshness ? (
                    <div className="flex flex-col items-start gap-1">
                      <FreshnessBadge freshness={freshness} />
                      {loc && now ? <span className="text-xs text-slate-500">{formatRelative(loc.updated_at, now)}</span> : null}
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {trip.status === "active" ? (
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/track/${trip.bus_id}`}
                        className="inline-flex min-h-10 items-center rounded-lg px-3 font-semibold text-brand-700 hover:bg-brand-50"
                      >
                        Map
                      </Link>
                      <button
                        type="button"
                        onClick={() => setCancelling(trip)}
                        className="min-h-10 rounded-lg px-3 font-semibold text-red-700 hover:bg-red-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancel this trip?"
        message={
          <>
            This ends the active trip for <strong>{cancelling?.bus?.bus_number}</strong> and stops accepting
            location updates from the driver. Use this only if the driver cannot end the trip themselves.
          </>
        }
        confirmLabel="Cancel trip"
        pending={pending}
        onConfirm={confirmCancel}
        onClose={() => setCancelling(null)}
      />
    </>
  );
}
