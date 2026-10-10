"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BusLocation, Trip } from "@/types/database";

export type ConnectionState = "connecting" | "live" | "reconnecting";

type Snapshot = { location: BusLocation | null; trip: Trip | null };

/**
 * Live location and active trip for one bus via Supabase Realtime.
 * Re-fetches a fresh snapshot whenever the channel (re)subscribes or the tab
 * becomes visible, so missed events while disconnected are recovered.
 */
export function useLiveBus(busId: string, initial: Snapshot) {
  const [location, setLocation] = useState<BusLocation | null>(initial.location);
  const [trip, setTrip] = useState<Trip | null>(initial.trip);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const tripIdRef = useRef<string | null>(initial.trip?.id ?? null);

  useEffect(() => {
    tripIdRef.current = trip?.id ?? null;
  }, [trip]);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [loc, active] = await Promise.all([
      supabase.from("bus_locations").select("*").eq("bus_id", busId).maybeSingle(),
      supabase.from("trips").select("*").eq("bus_id", busId).eq("status", "active").maybeSingle(),
    ]);
    if (!loc.error) setLocation(loc.data);
    if (!active.error) setTrip(active.data);
  }, [busId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`bus:${busId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bus_locations", filter: `bus_id=eq.${busId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setLocation(null);
            return;
          }
          const next = payload.new as BusLocation;
          setLocation(next);
          if (next.trip_id === null) {
            setTrip(null);
          } else if (next.trip_id !== tripIdRef.current) {
            // A trip we have not seen yet: load it.
            void refetch();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips", filter: `bus_id=eq.${busId}` },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const next = payload.new as Trip;
          if (next.status === "active") setTrip(next);
          else setTrip((current) => (current?.id === next.id ? null : current));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("live");
          void refetch();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("reconnecting");
        }
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [busId, refetch]);

  return { location, trip, connection };
}

/** Live locations and active trips for the whole visible fleet. */
export function useLiveFleet(initial: { locations: BusLocation[]; trips: Trip[] }) {
  const [locations, setLocations] = useState(() => new Map(initial.locations.map((l) => [l.bus_id, l])));
  const [trips, setTrips] = useState(() => new Map(initial.trips.map((t) => [t.bus_id, t])));
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [locs, active] = await Promise.all([
      supabase.from("bus_locations").select("*"),
      supabase.from("trips").select("*").eq("status", "active"),
    ]);
    if (!locs.error) setLocations(new Map(locs.data.map((l) => [l.bus_id, l])));
    if (!active.error) setTrips(new Map(active.data.map((t) => [t.bus_id, t])));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("fleet")
      .on("postgres_changes", { event: "*", schema: "public", table: "bus_locations" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const old = payload.old as Partial<BusLocation>;
          if (old.bus_id) {
            setLocations((m) => {
              const copy = new Map(m);
              copy.delete(old.bus_id!);
              return copy;
            });
          }
          return;
        }
        const next = payload.new as BusLocation;
        setLocations((m) => new Map(m).set(next.bus_id, next));
        if (next.trip_id === null) {
          setTrips((m) => {
            if (!m.has(next.bus_id)) return m;
            const copy = new Map(m);
            copy.delete(next.bus_id);
            return copy;
          });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, (payload) => {
        if (payload.eventType === "DELETE") return;
        const next = payload.new as Trip;
        setTrips((m) => {
          const copy = new Map(m);
          if (next.status === "active") copy.set(next.bus_id, next);
          else if (copy.get(next.bus_id)?.id === next.id) copy.delete(next.bus_id);
          return copy;
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("live");
          void refetch();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("reconnecting");
        }
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [refetch]);

  return { locations, trips, connection };
}
