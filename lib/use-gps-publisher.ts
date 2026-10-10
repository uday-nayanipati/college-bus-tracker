"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { checkFix, UPLOAD_INTERVAL_MS, type Fix } from "@/lib/geo";

export type GpsState =
  | "idle" // not sharing (no active trip)
  | "unsupported" // no Geolocation API
  | "insecure" // not HTTPS
  | "locating" // waiting for the first fix
  | "sharing" // fixes arriving
  | "weak" // fixes arriving but too inaccurate to publish
  | "denied" // permission denied
  | "unavailable"; // position unavailable / timeout

export type UploadState = "idle" | "ok" | "offline" | "retrying";

export type GpsPublisher = {
  gps: GpsState;
  upload: UploadState;
  fix: Fix | null;
  lastUploadAt: number | null;
  lastError: string | null;
  /** Set when the server says the trip is no longer active (e.g. cancelled by an admin). */
  tripEndedRemotely: boolean;
  /** True after the page was hidden while sharing; browsers may pause GPS then. */
  wasBackgrounded: boolean;
  dismissBackgroundNotice: () => void;
};

/**
 * While `busId` is set, watches the device position and publishes the latest
 * valid fix every UPLOAD_INTERVAL_MS through the update_bus_location RPC.
 * Stops the watcher, timers and wake lock when `busId` becomes null or the
 * component unmounts.
 */
const noopSubscribe = () => () => {};

function getCapability(): "ok" | "unsupported" | "insecure" {
  if (!("geolocation" in navigator)) return "unsupported";
  if (!window.isSecureContext) return "insecure";
  return "ok";
}

export function useGpsPublisher(busId: string | null): GpsPublisher {
  const capability = useSyncExternalStore(noopSubscribe, getCapability, () => "ok" as const);
  const [gps, setGps] = useState<GpsState>("locating");
  const [upload, setUpload] = useState<UploadState>("idle");
  const [fix, setFix] = useState<Fix | null>(null);
  const [lastUploadAt, setLastUploadAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [tripEndedRemotely, setTripEndedRemotely] = useState(false);
  const [wasBackgrounded, setWasBackgrounded] = useState(false);

  // Reset per-trip state when the bus being shared changes.
  const [sessionBusId, setSessionBusId] = useState(busId);
  if (sessionBusId !== busId) {
    setSessionBusId(busId);
    setGps("locating");
    setUpload("idle");
    setFix(null);
    setLastUploadAt(null);
    setLastError(null);
    setTripEndedRemotely(false);
    setWasBackgrounded(false);
  }

  const latestFix = useRef<Fix | null>(null);
  const uploadedTimestamp = useRef<number | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!busId || capability !== "ok") return;

    const supabase = createClient();
    let stopped = false;
    latestFix.current = null;
    uploadedTimestamp.current = null;

    const publish = async () => {
      const current = latestFix.current;
      if (stopped || inFlight.current || !current) return;
      if (checkFix(current)) return;
      if (uploadedTimestamp.current === current.timestamp) return;
      if (!navigator.onLine) {
        setUpload("offline");
        return;
      }

      inFlight.current = true;
      const { error } = await supabase.rpc("update_bus_location", {
        p_bus_id: busId,
        p_latitude: current.latitude,
        p_longitude: current.longitude,
        p_accuracy: current.accuracy,
      });
      inFlight.current = false;
      if (stopped) return;

      if (error) {
        if (/no active trip/i.test(error.message)) {
          setTripEndedRemotely(true);
          stopped = true;
          cleanup();
          return;
        }
        // Network failures surface as fetch errors without a Postgres code.
        setUpload(navigator.onLine ? "retrying" : "offline");
        setLastError(error.message);
        return;
      }
      uploadedTimestamp.current = current.timestamp;
      setUpload("ok");
      setLastUploadAt(Date.now());
      setLastError(null);
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next: Fix = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        const problem = checkFix(next);
        if (problem === "invalid") return;
        const isFirst = latestFix.current === null;
        latestFix.current = next;
        setFix(next);
        setGps(problem === "inaccurate" ? "weak" : "sharing");
        if (isFirst) void publish();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGps("denied");
        else setGps((prev) => (prev === "sharing" || prev === "weak" ? prev : "unavailable"));
        setLastError(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 },
    );

    const interval = setInterval(() => void publish(), UPLOAD_INTERVAL_MS);

    const onOnline = () => {
      setUpload((u) => (u === "offline" ? "retrying" : u));
      void publish();
    };
    const onOffline = () => setUpload("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Keep the screen on while sharing, where supported.
    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Not allowed (battery saver, unsupported); sharing still works while visible.
      }
    };
    void requestWakeLock();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        setWasBackgrounded(true);
      } else {
        void requestWakeLock();
        void publish();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    function cleanup() {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
      void wakeLock?.release().catch(() => {});
      wakeLock = null;
    }

    return () => {
      stopped = true;
      cleanup();
    };
  }, [busId, capability]);

  return {
    gps: !busId ? "idle" : capability !== "ok" ? capability : gps,
    upload,
    fix,
    lastUploadAt,
    lastError,
    tripEndedRemotely,
    wasBackgrounded,
    dismissBackgroundNotice: () => setWasBackgrounded(false),
  };
}
