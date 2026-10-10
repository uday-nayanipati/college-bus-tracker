import type { Metadata } from "next";
import Link from "next/link";
import { Bus, CircleDot, Route as RouteIcon, Users } from "lucide-react";
import { countRows, listLocations, listTrips } from "@/lib/queries";
import { PageHeader, StatCard, LinkButton } from "@/components/ui";
import { TripsTable } from "@/components/TripsTable";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const FILTERS = [
  { key: "active", label: "Active" },
  { key: "ended", label: "Completed" },
  { key: "all", label: "All" },
] as const;

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { trips: tripsParam } = await searchParams;
  const filter = FILTERS.find((f) => f.key === tripsParam)?.key ?? "active";

  const [busCount, inServiceCount, routeCount, driverCount, activeTripCount, trips, locations] =
    await Promise.all([
      countRows("buses"),
      countRows("buses", ["status", "active"]),
      countRows("routes"),
      countRows("profiles", ["role", "driver"]),
      countRows("trips", ["status", "active"]),
      listTrips(filter),
      listLocations(),
    ]);

  return (
    <>
      <PageHeader
        title="Fleet overview"
        description="Buses, drivers and trips at a glance."
        actions={
          <LinkButton href="/track" variant="secondary">
            Open live map
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active trips"
          value={activeTripCount}
          icon={<CircleDot aria-hidden className="size-5" />}
        />
        <StatCard
          label="Buses"
          value={busCount}
          icon={<Bus aria-hidden className="size-5" />}
          hint={`${inServiceCount} in service`}
        />
        <StatCard label="Drivers" value={driverCount} icon={<Users aria-hidden className="size-5" />} />
        <StatCard label="Routes" value={routeCount} icon={<RouteIcon aria-hidden className="size-5" />} />
      </div>

      <section className="mt-8" aria-labelledby="trips-heading">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="trips-heading" className="text-lg font-bold text-slate-900">
            Trips
          </h2>
          <nav aria-label="Trip filter" className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={`/dashboard?trips=${f.key}`}
                aria-current={filter === f.key ? "page" : undefined}
                className={cn(
                  "flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium sm:flex-none",
                  filter === f.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
                )}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        </div>
        <TripsTable trips={trips} locations={locations} filter={filter} />
      </section>
    </>
  );
}
