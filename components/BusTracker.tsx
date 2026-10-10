"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, ExternalLink, MapPinOff } from "lucide-react";
import { useLiveBus } from "@/lib/use-live-bus";
import { useNow } from "@/lib/use-now";
import { formatAccuracy } from "@/lib/geo";
import { cn, formatDateTime, formatRelative, locationFreshness } from "@/lib/utils";
import type { BusLocation, BusStatus, Route, Trip } from "@/types/database";
import { BusStatusBadge, FreshnessBadge, TripStatusBadge } from "./StatusBadge";
import { ConnectionPill } from "./ConnectionPill";
import { Alert } from "./ui";

// Leaflet touches `window`, so the map only renders in the browser.
const BusMap = dynamic(() => import("./BusMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-slate-100 text-sm text-slate-500">Loading map…</div>
  ),
});

type Props = {
  bus: { id: string; bus_number: string; status: BusStatus };
  route: Pick<Route, "route_name" | "start_point" | "end_point"> | null;
  initialLocation: BusLocation | null;
  initialTrip: Trip | null;
};

export function BusTracker({ bus, route, initialLocation, initialTrip }: Props) {
  const now = useNow();
  const { location, trip, connection } = useLiveBus(bus.id, {
    location: initialLocation,
    trip: initialTrip,
  });
  const [expanded, setExpanded] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);

  const freshness = now ? locationFreshness(location?.updated_at, now) : "live";
  const tripActive = trip !== null;
  const stale = !tripActive || freshness === "stale" || freshness === "offline";

  // Stable object so the map only reacts to real coordinate changes.
  const lat = location?.latitude;
  const lng = location?.longitude;
  const acc = location?.accuracy ?? null;
  const position = useMemo(
    () => (lat != null && lng != null ? { latitude: lat, longitude: lng, accuracy: acc } : null),
    [lat, lng, acc],
  );

  const osmLink = position
    ? `https://www.openstreetmap.org/?mlat=${position.latitude}&mlon=${position.longitude}#map=17/${position.latitude}/${position.longitude}`
    : null;

  const statusMessage = !tripActive
    ? location
      ? "This bus is not on a trip. Showing its last known location."
      : "This bus is not on a trip right now."
    : !location
      ? "Trip started. Waiting for the driver’s first location…"
      : freshness === "offline"
        ? "The driver’s phone has stopped sending updates. The position may be out of date."
        : freshness === "stale"
          ? "Updates are delayed. The bus may have moved since."
          : null;

  return (
    <div className="relative h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] min-h-[420px] w-full overflow-hidden">
      {/* Map, or a text fallback when tiles fail / there is no location */}
      {tilesFailed || !position ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 px-6 pb-48 text-center md:pb-0 md:pl-[24rem]">
          <MapPinOff aria-hidden className="size-10 text-slate-400" />
          <p className="font-semibold text-slate-800">
            {tilesFailed ? "The map could not be loaded" : "No location to show yet"}
          </p>
          <p className="max-w-xs text-sm text-slate-600">
            {tilesFailed
              ? "Check your connection. The bus details below still update live."
              : "The marker appears once the driver starts sharing their location."}
          </p>
        </div>
      ) : (
        <BusMap position={position} label={bus.bus_number} stale={stale} onTilesFailed={() => setTilesFailed(true)} />
      )}

      {/* Details: bottom sheet on phones, floating card on larger screens */}
      <section
        aria-label={`${bus.bus_number} details`}
        className={cn(
          "absolute inset-x-0 bottom-0 z-[1000] rounded-t-2xl bg-white shadow-[0_-4px_20px_rgb(0_0_0/0.12)]",
          "md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:w-[22rem] md:rounded-2xl md:shadow-lg",
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls="bus-details"
          className="flex w-full items-center gap-3 px-4 pb-3 pt-2 text-left md:pt-4"
        >
          <span className="min-w-0 flex-1">
            <span aria-hidden className="mx-auto mb-2 block h-1.5 w-10 rounded-full bg-slate-300 md:hidden" />
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold text-slate-900">{bus.bus_number}</span>
              {bus.status === "maintenance" ? (
                <BusStatusBadge status="maintenance" />
              ) : (
                <TripStatusBadge status={tripActive ? "active" : null} />
              )}
              {tripActive && now ? <FreshnessBadge freshness={freshness} /> : null}
            </span>
            <span className="mt-1 block text-sm text-slate-600">
              {location && now ? `Updated ${formatRelative(location.updated_at, now)}` : location ? "Updated recently" : "No location yet"}
            </span>
          </span>
          {expanded ? (
            <ChevronDown aria-hidden className="size-6 shrink-0 text-slate-500" />
          ) : (
            <ChevronUp aria-hidden className="size-6 shrink-0 text-slate-500" />
          )}
          <span className="sr-only">{expanded ? "Hide details" : "Show details"}</span>
        </button>

        <div
          id="bus-details"
          className={cn(
            "max-h-[50dvh] overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
            !expanded && "hidden",
          )}
        >
          {statusMessage ? (
            <Alert tone={tripActive ? "warning" : "info"} className="mb-3">
              {statusMessage}
            </Alert>
          ) : null}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Route</dt>
            <dd className="text-slate-900">
              {route ? (
                <>
                  <span className="font-medium">{route.route_name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1 text-slate-600">
                    {route.start_point} <ArrowRight aria-label="to" className="size-3.5" /> {route.end_point}
                  </span>
                </>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-slate-500">Trip started</dt>
            <dd className="text-slate-900">{trip ? formatDateTime(trip.started_at) : "—"}</dd>
            <dt className="text-slate-500">Last update</dt>
            <dd className="text-slate-900">{location ? formatDateTime(location.updated_at) : "—"}</dd>
            <dt className="text-slate-500">Accuracy</dt>
            <dd className="text-slate-900">{formatAccuracy(location?.accuracy)}</dd>
            {position ? (
              <>
                <dt className="text-slate-500">Coordinates</dt>
                <dd className="font-mono text-xs text-slate-900">
                  {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
                </dd>
              </>
            ) : null}
          </dl>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row md:flex-col">
            {osmLink ? (
              <a
                href={osmLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-100 hover:bg-brand-50"
              >
                Open in OpenStreetMap <ExternalLink aria-hidden className="size-4" />
              </a>
            ) : null}
            <Link
              href="/track"
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              <ArrowLeft aria-hidden className="size-4" /> All buses
            </Link>
          </div>
          <div className="mt-3 flex justify-center">
            <ConnectionPill state={connection} />
          </div>
        </div>
      </section>
    </div>
  );
}
