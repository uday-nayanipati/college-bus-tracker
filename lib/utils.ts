export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Locations older than this are shown as stale. */
export const STALE_AFTER_MS = 60_000;
/** Locations older than this are treated as offline. */
export const OFFLINE_AFTER_MS = 5 * 60_000;

export type Freshness = "live" | "stale" | "offline" | "none";

export function locationFreshness(updatedAt: string | null | undefined, now: number): Freshness {
  if (!updatedAt) return "none";
  const age = now - new Date(updatedAt).getTime();
  if (age > OFFLINE_AFTER_MS) return "offline";
  if (age > STALE_AFTER_MS) return "stale";
  return "live";
}

export function formatRelative(iso: string | null | undefined, now: number): string {
  if (!iso) return "never";
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTimeFormat.format(new Date(iso)) : "—";
}

export function formatDuration(startIso: string, endIso: string | null, now: number): string {
  const end = endIso ? new Date(endIso).getTime() : now;
  const minutes = Math.max(0, Math.round((end - new Date(startIso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** Turns a Postgres/PostgREST error into a message safe to show users. */
export function friendlyDbError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  switch (error.code) {
    case "23505":
      return "That value is already in use. Please choose another.";
    case "23503":
      return "This record is still referenced elsewhere (for example by trips), so it cannot be removed.";
    case "23514":
      return "Some values are out of range. Please check the form.";
    case "42501":
      return error.message && !/row-level security/i.test(error.message)
        ? capitalize(error.message)
        : "You do not have permission to do that.";
    case "P0001":
    case "22023":
      return capitalize(error.message ?? "Request rejected.");
    default:
      return "Something went wrong. Please try again.";
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
