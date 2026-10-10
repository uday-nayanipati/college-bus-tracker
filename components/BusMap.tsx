"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed } from "lucide-react";

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Fallback centre when no location is known yet (India). */
const DEFAULT_CENTER: L.LatLngTuple = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;
const FOLLOW_ZOOM = 16;

export type BusMapProps = {
  position: { latitude: number; longitude: number; accuracy: number | null } | null;
  label: string;
  stale: boolean;
  /** Called once if map tiles repeatedly fail to load. */
  onTilesFailed?: () => void;
};

const BUS_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>';

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function busIcon(label: string, stale: boolean) {
  return L.divIcon({
    className: stale ? "bus-marker bus-marker--stale" : "bus-marker",
    html: `<div class="bus-marker__pin">${BUS_SVG}</div><div class="bus-marker__label">${escapeHtml(label)}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

/**
 * Leaflet map with a single bus marker. The marker and accuracy circle are
 * created once and moved on each update (never re-created). The map follows
 * the bus until the user pans; "Re-centre" turns following back on.
 */
export default function BusMap({ position, label, stale, onTilesFailed }: BusMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const followRef = useRef(true);
  const [following, setFollowing] = useState(true);
  const onTilesFailedRef = useRef(onTilesFailed);

  useEffect(() => {
    onTilesFailedRef.current = onTilesFailed;
  }, [onTilesFailed]);

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: "topright" }).addTo(map);

    let tileErrors = 0;
    let tileLoads = 0;
    let reported = false;
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 })
      .on("tileload", () => {
        tileLoads++;
      })
      .on("tileerror", () => {
        tileErrors++;
        if (!reported && tileErrors >= 4 && tileLoads === 0) {
          reported = true;
          onTilesFailedRef.current?.();
        }
      })
      .addTo(map);

    // The user moved the map: stop auto-following the bus.
    map.on("dragstart", () => {
      followRef.current = false;
      setFollowing(false);
    });

    // Keep tiles correct when the container changes size (panels, rotation).
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    mapRef.current = map;
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  // Move (or create once) the marker when the position changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!position) {
      markerRef.current?.remove();
      circleRef.current?.remove();
      markerRef.current = null;
      circleRef.current = null;
      return;
    }

    const latLng = L.latLng(position.latitude, position.longitude);
    const radius = position.accuracy ?? 0;

    if (!markerRef.current) {
      markerRef.current = L.marker(latLng, {
        icon: busIcon(label, stale),
        keyboard: true,
        title: label,
        alt: label,
      }).addTo(map);
      circleRef.current = L.circle(latLng, {
        radius,
        color: "#2563eb",
        weight: 1,
        fillOpacity: 0.1,
        interactive: false,
      }).addTo(map);
      map.setView(latLng, FOLLOW_ZOOM);
      return;
    }

    markerRef.current.setLatLng(latLng);
    circleRef.current?.setLatLng(latLng).setRadius(radius);
    if (followRef.current) map.panTo(latLng, { animate: true });
  }, [position, label, stale]);

  // Restyle the marker when it becomes stale or the label changes.
  useEffect(() => {
    markerRef.current?.setIcon(busIcon(label, stale));
  }, [label, stale]);

  const recenter = () => {
    followRef.current = true;
    setFollowing(true);
    const map = mapRef.current;
    if (map && position) map.setView([position.latitude, position.longitude], Math.max(map.getZoom(), FOLLOW_ZOOM));
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" role="region" aria-label={`Map showing ${label}`} />
      {position && !following ? (
        <button
          type="button"
          onClick={recenter}
          className="absolute left-3 top-3 z-[500] flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-slate-800 shadow-md ring-1 ring-slate-200"
        >
          <LocateFixed aria-hidden className="size-4" /> Re-centre on bus
        </button>
      ) : null}
    </div>
  );
}
