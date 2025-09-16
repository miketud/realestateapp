// src/components/MapOSM.tsx
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type LatLng = { lat: number; lng: number };

// Flexible row shape from the server (street + parts)
type RawRow = {
  id?: number | string;
  property_id?: number | string;
  name?: string | null;
  property_name?: string | null;
  address?: string;   // street
  city?: string | null;
  state?: string | null;
  zipcode?: string | number | null;
  lat?: number | null;
  lng?: number | null;
  [k: string]: any;
};

type MarkerInput = {
  id: number | string;
  name: string;
  address: string; // street
  city?: string;
  state?: string;
  zipcode?: string | number | null;
  lat?: number | null;
  lng?: number | null;
};

// Default Leaflet pin
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Inject UI styles (popup only + safe stacking context for map UI)
function injectMapCss() {
  if (typeof document === 'undefined') return;
  const id = 'pm-map-css';
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.appendChild(style);
  }
  style.textContent = `
    .leaflet-container {
      position: relative;
      z-index: 0;
      isolation: isolate;
      overflow: hidden;
    }
    .pm-popup .leaflet-popup-content-wrapper {
      padding: 18px 22px;
      border-radius: 14px;
      border: 2px solid #111;
      box-shadow: 0 18px 40px rgba(0,0,0,.35);
    }
    .pm-popup .leaflet-popup-content { margin: 0; line-height: 1.5; }
    .pm-popup .pm-title { font-size: 20px; font-weight: 900; margin-bottom: 6px; }
    .pm-popup .pm-addr  { font-size: 16px; }
  `;
}

// Auto-fit to markers once (disabled by default via prop)
function FitBoundsOnce({
  points,
  hasAutoFit,
  setHasAutoFit,
}: {
  points: LatLng[];
  hasAutoFit: boolean;
  setHasAutoFit: (v: boolean) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (hasAutoFit) return;
    if (!points.length) return;

    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 15), { animate: true });
    } else {
      const b = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(b, { padding: [40, 40] });
    }
    setHasAutoFit(true);
  }, [points, hasAutoFit, setHasAutoFit, map]);

  return null;
}

// OSM/Nominatim geocoder
async function geocodeAddress(full: string, signal?: AbortSignal): Promise<LatLng | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', full);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'PropertyManager/1.0 (admin@yourdomain.com)',
      'Accept-Language': 'en',
    },
    signal,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data?.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// Normalize server rows to MarkerInput
function normalize(rows: RawRow[]): MarkerInput[] {
  return rows
    .map((r) => ({
      id: (r.id ?? r.property_id)!,
      name: (r.name ?? r.property_name ?? 'Property') as string,
      address: r.address ?? '',            // street
      city: r.city ?? undefined,
      state: r.state ?? undefined,
      zipcode: r.zipcode ?? null,
      lat: r.lat ?? null,
      lng: r.lng ?? null,
    }))
    .filter((m) => m.id != null && m.address);
}

// Focus on a specific property via window event
function FocusOnProperty({
  rows,
  coords,
  setCoords,
  setHasAutoFit,
  onFocused,
  zoom = 16,
}: {
  rows: MarkerInput[];
  coords: Record<string | number, LatLng>;
  setCoords: React.Dispatch<React.SetStateAction<Record<string | number, LatLng>>>;
  setHasAutoFit: (v: boolean) => void;
  onFocused?: (p: LatLng) => void;
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const handler = async (ev: Event) => {
      const e = ev as CustomEvent<{
        id: string | number;
        zoom?: number;
        address?: string;
        city?: string;
        state?: string;
        zipcode?: string | number | null;
      }>;
      const d = e.detail || ({} as any);
      if (d.id == null) return;

      let pos = coords[d.id];
      if (!pos) {
        const row = byId.get(d.id);
        const street = d.address ?? row?.address ?? '';
        const c = d.city ?? row?.city ?? '';
        const s = d.state ?? row?.state ?? '';
        const z = (d.zipcode ?? row?.zipcode ?? '') + '';
        const full = [street, c, s, z].filter(Boolean).join(', ');
        if (full) {
          try {
            const hit = await geocodeAddress(full);
            if (hit) {
              setCoords((prev) => ({ ...prev, [d.id]: hit }));
              pos = hit;
            }
          } catch { /* ignore */ }
        }
      }
      if (pos) {
        setHasAutoFit(true); // prevent later auto-fit
        map.setView(pos, d.zoom ?? zoom, { animate: true });
        onFocused?.(pos);
      }
    };

    window.addEventListener('pm:focus', handler as EventListener);
    return () => window.removeEventListener('pm:focus', handler as EventListener);
  }, [rows, coords, setCoords, setHasAutoFit, map, zoom, onFocused]);

  return null;
}

export default function MapOSM({
  endpoint = '/api/property_markers',
  height = 520,
  fallbackGeocode = false,   // geocode rows missing lat/lng
  throttleMs = 1100,
  loadingText = 'Loading map…',
  defaultCenter = { lat: 39.8283, lng: -98.5795 }, // approx. center of contiguous US
  defaultZoom = 4,
  fitMarkersOnLoad = false,  // set true if you prefer initial auto-fit to your markers
}: {
  endpoint?: string;
  height?: number;
  fallbackGeocode?: boolean;
  throttleMs?: number;
  loadingText?: string;
  defaultCenter?: LatLng;
  defaultZoom?: number;
  fitMarkersOnLoad?: boolean;
}) {
  useEffect(() => injectMapCss(), []);

  const [rows, setRows] = useState<MarkerInput[]>([]);
  const [coords, setCoords] = useState<Record<string | number, LatLng>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoFit, setHasAutoFit] = useState(!fitMarkersOnLoad); // skip if we don't want auto-fit

  // Fetch directly from server
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as RawRow[];
        const m = normalize(data);
        if (cancelled) return;

        // seed coords from DB lat/lng
        const seed: Record<string | number, LatLng> = {};
        for (const r of m) {
          if (r.lat != null && r.lng != null) seed[r.id] = { lat: r.lat, lng: r.lng };
        }
        setRows(m);
        setCoords(seed);

        // allow auto-fit if enabled
        setHasAutoFit(!fitMarkersOnLoad ? true : false);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load map data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endpoint, fitMarkersOnLoad]);

  // Optional client-side geocoding for those missing coords (uses street + city/state/zip)
  useEffect(() => {
    if (!fallbackGeocode) return;
    const need = rows.filter((r) => !(r.id in coords));
    if (!need.length) return;

    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true);
      for (let i = 0; i < need.length; i++) {
        if (cancelled) break;
        const r = need[i];
        const full = [r.address, r.city, r.state, r.zipcode].filter(Boolean).join(', ');
        try {
          const ll = await geocodeAddress(full, ctrl.signal);
          if (ll && !cancelled) setCoords((prev) => ({ ...prev, [r.id]: ll }));
        } catch { /* ignore */ }
        if (i < need.length - 1) await new Promise((res) => setTimeout(res, throttleMs));
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [fallbackGeocode, rows, coords, throttleMs]);

  const markers = useMemo(
    () =>
      rows
        .map((r) => {
          const fullAddress = [r.address, r.city, r.state, r.zipcode].filter(Boolean).join(', ') || r.address;
          const pos = coords[r.id];
          return pos ? { id: r.id, name: r.name, addr: fullAddress, pos } : null;
        })
        .filter(Boolean) as Array<{ id: string | number; name: string; addr: string; pos: LatLng }>,
    [rows, coords]
  );

  const points = markers.map((m) => m.pos);

  return (
    <div style={{ width: '100%', height }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ width: '100%', height: '100%' }}
        worldCopyJump
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Optional initial auto-fit to all markers */}
        {fitMarkersOnLoad && (
          <FitBoundsOnce points={points} hasAutoFit={hasAutoFit} setHasAutoFit={setHasAutoFit} />
        )}

        {/* Detail focus handler (PropertyView -> window.dispatchEvent('pm:focus', {detail:{...}})) */}
        <FocusOnProperty
          rows={rows}
          coords={coords}
          setCoords={setCoords}
          setHasAutoFit={setHasAutoFit}
          // onFocused unused here (no search marker to clear)
          zoom={16}
        />

        {/* Property markers */}
        {markers.map((m) => (
          <Marker key={m.id} position={m.pos} icon={DefaultIcon} zIndexOffset={1000}>
            <Popup
              className="pm-popup"
              maxWidth={460}
              minWidth={280}
              keepInView={true}
              autoPanPadding={[40, 40]}
            >
              <div className="pm-title">{m.name}</div>
              <div className="pm-addr">{m.addr}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div style={{ padding: 8, fontSize: 13 }}>
        {error
          ? `Error: ${error}`
          : loading
          ? loadingText
          : markers.length === 0
          ? 'No mappable properties yet. Add addresses or run the geocode helper.'
          : `${markers.length} location${markers.length === 1 ? '' : 's'} plotted.`}
      </div>
    </div>
  );
}
