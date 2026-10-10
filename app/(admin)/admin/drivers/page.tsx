import type { Metadata } from "next";
import { listBuses, listProfiles, listTrips } from "@/lib/queries";
import { DriverManager } from "./DriverManager";

export const metadata: Metadata = { title: "Drivers" };

export default async function DriversPage() {
  const [profiles, buses, activeTrips] = await Promise.all([listProfiles(), listBuses(), listTrips("active", 500)]);

  return (
    <DriverManager
      drivers={profiles.filter((p) => p.role === "driver")}
      students={profiles.filter((p) => p.role === "student")}
      buses={buses}
      activeDriverIds={activeTrips.map((t) => t.driver_id)}
    />
  );
}
