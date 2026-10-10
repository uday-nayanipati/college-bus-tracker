import type { Metadata } from "next";
import { listBuses, listRoutes } from "@/lib/queries";
import { RouteManager } from "./RouteManager";

export const metadata: Metadata = { title: "Routes" };

export default async function RoutesPage() {
  const [routes, buses] = await Promise.all([listRoutes(), listBuses()]);
  const busCountByRoute: Record<string, number> = {};
  for (const bus of buses) {
    if (bus.route_id) busCountByRoute[bus.route_id] = (busCountByRoute[bus.route_id] ?? 0) + 1;
  }
  return <RouteManager routes={routes} busCountByRoute={busCountByRoute} />;
}
