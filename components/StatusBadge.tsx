import {
  CircleCheck,
  CircleDot,
  CircleOff,
  CircleSlash,
  Clock,
  Radio,
  Wrench,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { cn, type Freshness } from "@/lib/utils";
import type { BusStatus, TripStatus } from "@/types/database";

type Tone = "green" | "blue" | "amber" | "red" | "slate";

const toneClasses: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  blue: "bg-brand-50 text-brand-800 ring-brand-100",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

function Badge({
  tone,
  Icon,
  label,
  pulse,
  className,
}: {
  tone: Tone;
  Icon: LucideIcon;
  label: string;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      <Icon aria-hidden className={cn("size-3.5", pulse && "animate-pulse")} />
      {label}
    </span>
  );
}

const busStatus: Record<BusStatus, { tone: Tone; Icon: LucideIcon; label: string }> = {
  active: { tone: "green", Icon: CircleCheck, label: "In service" },
  maintenance: { tone: "amber", Icon: Wrench, label: "Maintenance" },
  inactive: { tone: "slate", Icon: CircleOff, label: "Inactive" },
};

const tripStatus: Record<TripStatus, { tone: Tone; Icon: LucideIcon; label: string; pulse?: boolean }> = {
  active: { tone: "blue", Icon: CircleDot, label: "On trip", pulse: true },
  completed: { tone: "slate", Icon: CircleCheck, label: "Completed" },
  cancelled: { tone: "red", Icon: CircleSlash, label: "Cancelled" },
};

const freshness: Record<Freshness, { tone: Tone; Icon: LucideIcon; label: string; pulse?: boolean }> = {
  live: { tone: "green", Icon: Radio, label: "Live", pulse: true },
  stale: { tone: "amber", Icon: Clock, label: "Delayed update" },
  offline: { tone: "red", Icon: WifiOff, label: "Signal lost" },
  none: { tone: "slate", Icon: CircleOff, label: "No location" },
};

export function BusStatusBadge({ status, className }: { status: BusStatus; className?: string }) {
  return <Badge {...busStatus[status]} className={className} />;
}

export function TripStatusBadge({ status, className }: { status: TripStatus | null; className?: string }) {
  if (!status) return <Badge tone="slate" Icon={CircleOff} label="Not running" className={className} />;
  return <Badge {...tripStatus[status]} className={className} />;
}

export function FreshnessBadge({ freshness: f, className }: { freshness: Freshness; className?: string }) {
  return <Badge {...freshness[f]} className={className} />;
}
