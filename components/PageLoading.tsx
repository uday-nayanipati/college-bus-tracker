import { Loader2 } from "lucide-react";

export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-slate-600">
      <Loader2 aria-hidden className="size-5 animate-spin" />
      {label}
    </div>
  );
}
