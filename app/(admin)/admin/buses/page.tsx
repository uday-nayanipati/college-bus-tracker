import type { Metadata } from "next";
import { listBuses, listRoutes } from "@/lib/queries";
import { BusManager } from "@/components/BusTable";

export const metadata: Metadata = { title: "Buses" };

export default async function BusesPage() {
  const [buses, routes] = await Promise.all([listBuses(), listRoutes()]);
  return <BusManager buses={buses} routes={routes} />;
}
