"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CloudOff,
  Loader2,
  LocateFixed,
  LocateOff,
  MapPinOff,
  Play,
  RefreshCw,
  ShieldAlert,
  Signal,
  Square,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useGpsPublisher, type GpsState, type UploadState } from "@/lib/use-gps-publisher";
import { useNow } from "@/lib/use-now";
import { formatAccuracy } from "@/lib/geo";
import { cn, formatDuration, formatRelative, friendlyDbError } from "@/lib/utils";
import type { BusStatus, Route, Trip } from "@/types/database";
import { ConfirmDialog } from "./Modal";
import { BusStatusBadge, TripStatusBadge } from "./StatusBadge";
import { Alert, Button, Card } from "./ui";

type Props = {
  bus: { id: string; bus_number: string; status: BusStatus };
  route: Pick<Route, "route_name" | "start_point" | "end_point"> | null;
  activeTrip: Trip | null;
  otherBusTrip: boolean;
};

const GPS_DISPLAY: Record<GpsState, { Icon: LucideIcon; label: string; detail: string; tone: string }> = {
  idle: {
    Icon: LocateOff,
    label: "Not sharing",
    detail: "Location is shared only while a trip is active.",
    tone: "bg-slate-100 text-slate-700",
  },
  locating: {
    Icon: Loader2,
    label: "Finding your location…",
    detail: "Allow location access if your phone asks.",
    tone: "bg-brand-50 text-brand-800",
  },
  sharing: {
    Icon: LocateFixed,
    label: "Sharing location",
    detail: "Students can see this bus on the map.",
    tone: "bg-emerald-50 text-emerald-800",
  },
  weak: {
    Icon: Signal,
    label: "Weak GPS signal",
    detail: "Waiting for a more accurate fix before publishing. Move to open sky if you can.",
    tone: "bg-amber-50 text-amber-900",
  },
  denied: {
    Icon: ShieldAlert,
    label: "Location permission denied",
    detail: "Allow location for this site in your browser settings, then reload the page.",
    tone: "bg-red-50 text-red-800",
  },
  unavailable: {
    Icon: MapPinOff,
    label: "GPS unavailable",
    detail: "Your phone could not get a location. Check that location services are on.",
    tone: "bg-red-50 text-red-800",
  },
  unsupported: {
    Icon: MapPinOff,
    label: "GPS not supported",
    detail: "This browser cannot share location. Try Chrome or Safari on your phone.",
    tone: "bg-red-50 text-red-800",
  },
  insecure: {
    Icon: ShieldAlert,
    label: "Secure connection required",
    detail: "Browsers only share location over HTTPS. Open the app using its https:// address.",
    tone: "bg-red-50 text-red-800",
  },
};

const UPLOAD_LABEL: Record<UploadState, { label: string; Icon: LucideIcon | null }> = {
  idle: { label: "Waiting", Icon: null },
  ok: { label: "Connected", Icon: null },
  offline: { label: "Offline, will retry", Icon: CloudOff },
  retrying: { label: "Reconnecting…", Icon: RefreshCw },
};

export function DriverTripControls({ bus, route, activeTrip, otherBusTrip }: Props) {
  const router = useRouter();
  const now = useNow();
  const [trip, setTrip] = useState<Trip | null>(activeTrip);
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [pending, startTransition] = useTransition();

  const publisher = useGpsPublisher(trip ? bus.id : null);
  const tripRunning = trip !== null && !publisher.tripEndedRemotely;
  const gpsInfo = GPS_DISPLAY[tripRunning ? publisher.gps : "idle"];
  const upload = UPLOAD_LABEL[publisher.upload];
  const canStart = bus.status === "active" && !otherBusTrip;

  const startTrip = () => {
    setError(null);
    startTransition(async () => {
      const { data, error } = await createClient().rpc("start_trip", { p_bus_id: bus.id });
      if (error || !data) {
        setError(friendlyDbError(error));
        return;
      }
      setTrip(data);
      router.refresh();
    });
  };

  const endTrip = () => {
    if (!trip) return;
    setError(null);
    startTransition(async () => {
      const { error } = await createClient().rpc("end_trip", { p_trip_id: trip.id });
      setConfirmEnd(false);
      if (error && !/not active/i.test(error.message)) {
        setError(friendlyDbError(error));
        return;
      }
      setTrip(null);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 pb-32">
      {/* Bus and route */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your bus</p>
            <p className="text-2xl font-bold text-slate-900">{bus.bus_number}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <TripStatusBadge status={tripRunning ? "active" : null} />
            {bus.status !== "active" ? <BusStatusBadge status={bus.status} /> : null}
          </div>
        </div>
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Route</p>
          {route ? (
            <>
              <p className="font-medium text-slate-900">{route.route_name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-sm text-slate-600">
                <span>{route.start_point}</span>
                <ArrowRight aria-label="to" className="size-4" />
                <span>{route.end_point}</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600">No route assigned</p>
          )}
        </div>
        {tripRunning && trip && now ? (
          <p className="mt-3 text-sm text-slate-600">
            Trip running for <strong className="text-slate-900">{formatDuration(trip.started_at, null, now)}</strong>
          </p>
        ) : null}
      </Card>

      {/* GPS status */}
      <Card className="p-4" aria-live="polite">
        <div className={cn("flex items-start gap-3 rounded-xl p-3", gpsInfo.tone)}>
          <gpsInfo.Icon
            aria-hidden
            className={cn("mt-0.5 size-6 shrink-0", tripRunning && publisher.gps === "locating" && "animate-spin")}
          />
          <div className="min-w-0">
            <p className="font-semibold">{gpsInfo.label}</p>
            <p className="text-sm opacity-90">{gpsInfo.detail}</p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-2">
            <dt className="text-xs text-slate-500">Accuracy</dt>
            <dd className="font-semibold tabular-nums text-slate-900">
              {tripRunning ? formatAccuracy(publisher.fix?.accuracy) : "—"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <dt className="text-xs text-slate-500">Last upload</dt>
            <dd className="font-semibold text-slate-900">
              {tripRunning && publisher.lastUploadAt && now
                ? formatRelative(new Date(publisher.lastUploadAt).toISOString(), now)
                : "—"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <dt className="text-xs text-slate-500">Network</dt>
            <dd className="flex items-center justify-center gap-1 text-sm font-semibold text-slate-900">
              {tripRunning ? (
                <>
                  {upload.Icon ? <upload.Icon aria-hidden className="size-4" /> : null}
                  {upload.label}
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </Card>

      {publisher.tripEndedRemotely ? (
        <Alert tone="warning" title="Trip ended">
          This trip was ended by the transport office. Location sharing has stopped.{" "}
          <button type="button" className="font-semibold underline" onClick={() => { setTrip(null); router.refresh(); }}>
            Refresh
          </button>
        </Alert>
      ) : null}

      {tripRunning && publisher.wasBackgrounded ? (
        <Alert tone="warning" title="Keep this page open">
          Your phone may pause location sharing while the screen is locked or another app is open.{" "}
          <button type="button" className="font-semibold underline" onClick={publisher.dismissBackgroundNotice}>
            OK
          </button>
        </Alert>
      ) : null}

      {!tripRunning ? (
        <Alert tone="info">
          When you start a trip, keep this page open with the screen on. Browsers may stop sharing location when
          the phone is locked or the browser is in the background.
        </Alert>
      ) : null}

      {otherBusTrip ? (
        <Alert tone="warning">You have an active trip on another bus. Ask the transport office to end it.</Alert>
      ) : bus.status !== "active" ? (
        <Alert tone="warning">This bus is marked as {bus.status}. Trips can only start on buses in service.</Alert>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* Primary action, fixed to the bottom of the screen within thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-lg md:max-w-2xl">
          {tripRunning ? (
            <Button variant="danger" size="xl" className="w-full" disabled={pending} onClick={() => setConfirmEnd(true)}>
              <Square aria-hidden className="size-6" /> End trip
            </Button>
          ) : (
            <Button variant="success" size="xl" className="w-full" disabled={pending || !canStart} onClick={startTrip}>
              {pending ? <Loader2 aria-hidden className="size-6 animate-spin" /> : <Play aria-hidden className="size-6" />}
              {pending ? "Starting…" : "Start trip"}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        title="End this trip?"
        message="Location sharing will stop and students will see the trip as ended."
        confirmLabel="End trip"
        pending={pending}
        onConfirm={endTrip}
        onClose={() => setConfirmEnd(false)}
      />
    </div>
  );
}
