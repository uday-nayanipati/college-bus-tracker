"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Bus as BusIcon, ChevronRight, Search } from "lucide-react";
import { useLiveFleet } from "@/lib/use-live-bus";
import { useNow } from "@/lib/use-now";
import { cn, formatRelative, locationFreshness } from "@/lib/utils";
import type { BusLocation, BusStatus, Route, Trip } from "@/types/database";
import { BusStatusBadge, FreshnessBadge, TripStatusBadge } from "./StatusBadge";
import { EmptyState, Input, Label, PageHeader, Select } from "./ui";
import { ConnectionPill } from "./ConnectionPill";

type FleetBus = {
  id: string;
  bus_number: string;
  status: BusStatus;
  route: Pick<Route, "route_name" | "start_point" | "end_point"> | null;
};

export function FleetList({
  buses,
  routes,
  locations,
  trips,
}: {
  buses: FleetBus[];
  routes: Pick<Route, "id" | "route_name">[];
  locations: BusLocation[];
  trips: Trip[];
}) {
  const now = useNow();
  const live = useLiveFleet({ locations, trips });
  const [query, setQuery] = useState("");
  const [routeName, setRouteName] = useState("");
  const [onlyRunning, setOnlyRunning] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = buses
    .filter(
      (b) =>
        (!q ||
          b.bus_number.toLowerCase().includes(q) ||
          b.route?.route_name.toLowerCase().includes(q) ||
          b.route?.start_point.toLowerCase().includes(q) ||
          b.route?.end_point.toLowerCase().includes(q)) &&
        (!routeName || b.route?.route_name === routeName) &&
        (!onlyRunning || live.trips.has(b.id)),
    )
    // Running buses first.
    .sort((a, b) => Number(live.trips.has(b.id)) - Number(live.trips.has(a.id)) || a.bus_number.localeCompare(b.bus_number));

  return (
    <>
      <PageHeader
        title="Find your bus"
        description="Tap a bus to see it on the live map."
        actions={<ConnectionPill state={live.connection} />}
      />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Label htmlFor="fleet-search" className="sr-only">
            Search buses
          </Label>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 mt-0.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="fleet-search"
            type="search"
            placeholder="Bus number, route or stop"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="sm:flex-1">
            <Label htmlFor="fleet-route" className="sr-only">
              Filter by route
            </Label>
            <Select id="fleet-route" value={routeName} onChange={(e) => setRouteName(e.target.value)}>
              <option value="">All routes</option>
              {routes.map((r) => (
                <option key={r.id} value={r.route_name}>
                  {r.route_name}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={onlyRunning}
              onChange={(e) => setOnlyRunning(e.target.checked)}
              className="size-5 rounded border-slate-300 text-brand-600"
            />
            Only buses on a trip
          </label>
        </div>
      </div>

      {buses.length === 0 ? (
        <EmptyState icon={<BusIcon className="size-8" />} title="No buses available">
          The transport office has not added any buses yet.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title="No buses match your search" />
      ) : (
        <ul className="space-y-3">
          {filtered.map((bus) => {
            const trip = live.trips.get(bus.id) ?? null;
            const loc = live.locations.get(bus.id);
            const freshness = trip && now ? locationFreshness(loc?.updated_at, now) : null;
            return (
              <li key={bus.id}>
                <Link
                  href={`/track/${bus.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-colors hover:ring-brand-500",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-xl",
                      trip ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    <BusIcon aria-hidden className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{bus.bus_number}</p>
                      {bus.status === "maintenance" ? (
                        <BusStatusBadge status="maintenance" />
                      ) : (
                        <TripStatusBadge status={trip ? "active" : null} />
                      )}
                    </div>
                    {bus.route ? (
                      <p className="mt-0.5 flex flex-wrap items-center gap-1 text-sm text-slate-600">
                        <span className="truncate">{bus.route.start_point}</span>
                        <ArrowRight aria-label="to" className="size-3.5 shrink-0" />
                        <span className="truncate">{bus.route.end_point}</span>
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm text-slate-500">No route</p>
                    )}
                    {freshness ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <FreshnessBadge freshness={freshness} />
                        {loc && now ? <span>Updated {formatRelative(loc.updated_at, now)}</span> : null}
                      </div>
                    ) : null}
                  </div>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-slate-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
