import { Loader2, Radio, RefreshCw } from "lucide-react";
import type { ConnectionState } from "@/lib/use-live-bus";
import { cn } from "@/lib/utils";

const DISPLAY = {
  connecting: { Icon: Loader2, label: "Connecting…", cls: "bg-slate-100 text-slate-700", spin: true },
  live: { Icon: Radio, label: "Live updates on", cls: "bg-emerald-50 text-emerald-800", spin: false },
  reconnecting: { Icon: RefreshCw, label: "Reconnecting…", cls: "bg-amber-50 text-amber-900", spin: true },
} as const;

export function ConnectionPill({ state, className }: { state: ConnectionState; className?: string }) {
  const { Icon, label, cls, spin } = DISPLAY[state];
  return (
    <span
      role="status"
      className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", cls, className)}
    >
      <Icon aria-hidden className={cn("size-3.5", spin && "animate-spin")} />
      {label}
    </span>
  );
}
