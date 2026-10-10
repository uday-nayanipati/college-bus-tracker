/** How often the driver's phone publishes its location while a trip is active. */
export const UPLOAD_INTERVAL_MS = 7_000;

/** Fixes worse than this are not published (they would mislead students). */
export const MAX_ACCEPTED_ACCURACY_M = 500;

export type Fix = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export type FixProblem = "invalid" | "inaccurate";

/** Validates a browser geolocation reading before it is published. */
export function checkFix(fix: Fix): FixProblem | null {
  const { latitude, longitude, accuracy } = fix;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return "invalid";
  }
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > MAX_ACCEPTED_ACCURACY_M) {
    return "inaccurate";
  }
  return null;
}

export function formatAccuracy(meters: number | null | undefined) {
  if (meters == null || !Number.isFinite(meters)) return "—";
  return meters >= 1000 ? `±${(meters / 1000).toFixed(1)} km` : `±${Math.round(meters)} m`;
}
