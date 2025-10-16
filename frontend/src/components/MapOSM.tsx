// src/components/MapOSM.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AnimatePresence, motion } from 'framer-motion';

type LatLng = { lat: number; lng: number };

type RawRow = {
  id?: number | string;
  property_id?: number | string;
  name?: string | null;
  property_name?: string | null;
  address?: string | null;
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
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | number | null;
  lat?: number | null;
  lng?: number | null;
};

const APP_WIDTH = 1575;

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function injectMapCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('pm-map-css')) return;
  const style = document.createElement('style');
  style.id = 'pm-map-css';
  style.textContent = `
    .leaflet-container { position: relative; z-index: 0; isolation: isolate; overflow: hidden; }
    .pm-popup .leaflet-popup-content-wrapper { padding: 18px 22px; border-radius: 14px; border: 1px solid #111; box-shadow: 0 18px 40px rgba(0,0,0,.35); }
    .pm-popup .leaflet-popup-content { margin: 0; line-height: 1.5; }
    .pm-popup .pm-title { font-size: 20px; font-weight: 900; margin-bottom: 6px; }
    .pm-popup .pm-addr  { font-size: 16px; }
  `;
  document.head.appendChild(style);
}

function isLatLng(v: any): v is LatLng {
  return v != null && typeof v.lat === 'number' && typeof v.lng === 'number';
}

function normalize(rows: RawRow[]): MarkerInput[] {
  // Keep rows even if street address is missing. We will fallback to city/state/zip.
  return rows
    .map((r) => ({
      id: (r.id ?? r.property_id)!,
      name: (r.name ?? r.property_name ?? 'Property') as string,
      address: r.address ?? null,
      city: r.city ?? null,
      state: r.state ?? null,
      zipcode: r.zipcode ?? null,
      lat: r.lat ?? null,
      lng: r.lng ?? null,
    }))
    .filter((m) => m.id != null);
}

function FitBoundsOnce({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 15), { animate: true });
    } else {
      const b = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(b, { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
}

async function geocodeAddress(full: string, signal?: AbortSignal): Promise<LatLng | null> {
  const q = full.trim();
  if (!q) return null;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'PropertyManager/1.0 (admin@yourdomain.com)', 'Accept-Language': 'en' },
    signal,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data?.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

function FocusOnProperty({
  rows,
  coords,
  setCoords,
  defaultZoom = 16,
}: {
  rows: Array<{ id: string | number; address?: string | null; city?: string | null; state?: string | null; zipcode?: string | number | null }>;
  coords: Record<string | number, LatLng>;
  setCoords: React.Dispatch<React.SetStateAction<Record<string | number, LatLng>>>;
  defaultZoom?: number;
}) {
  const map = useMap();
  const ctrlRef = useRef<AbortController | null>(null);
  const lastRef = useRef<{ id?: string | number; stamp: number } | null>(null);

  useEffect(() => {
    const byId = new Map(rows.map((r) => [String(r.id), r]));
    const handle = async (ev: Event) => {
      const d = (ev as CustomEvent<{
        id?: string | number;
        zoom?: number;
        address?: string | null;
        city?: string | null;
        state?: string | null;
        zipcode?: string | number | null;
      }>).detail || {};

      const idKey = d.id != null ? String(d.id) : undefined;
      const row = idKey ? byId.get(idKey) : undefined;

      const street = (d.address ?? row?.address ?? '')?.toString().trim();
      const city = (d.city ?? row?.city ?? '')?.toString().trim();
      const state = (d.state ?? row?.state ?? '')?.toString().trim();
      const zip = (d.zipcode ?? row?.zipcode ?? '')?.toString().trim();

      const full = [street, city, state, zip].filter(Boolean).join(', ');
      const fallback = [city, state, zip].filter(Boolean).join(', ');

      const now = Date.now();
      if (lastRef.current && lastRef.current.id === d.id && now - lastRef.current.stamp < 250) return;
      lastRef.current = { id: d.id, stamp: now };

      let pos: LatLng | undefined = idKey ? coords[idKey] : undefined;

      ctrlRef.current?.abort();
      ctrlRef.current = null;

      if (!pos && (full || fallback)) {
        const ctrl = new AbortController();
        ctrlRef.current = ctrl;
        try {
          let hit: LatLng | null = null;
          hit = await geocodeAddress(full, ctrl.signal);
          if (!hit && fallback) hit = await geocodeAddress(fallback, ctrl.signal);
          if (isLatLng(hit) && idKey) {
            setCoords((prev) => {
              const next: Record<string | number, LatLng> = { ...prev };
              next[idKey] = hit!;
              return next;
            });
            pos = hit!;
          }
        } catch {
          // ignore
        }
      }

      if (pos) {
        const zoom = d.zoom ?? defaultZoom;
        const cur = map.getCenter();
        const dist = map.distance(cur, L.latLng(pos.lat, pos.lng));
        if (dist > 600) map.flyTo(pos, zoom, { animate: true, duration: 0.9 });
        else map.setView(pos, Math.max(map.getZoom(), zoom), { animate: true });
        setTimeout(() => map.invalidateSize(true), 0);
      }
    };

    window.addEventListener('pm:focus', handle as EventListener);
    return () => {
      window.removeEventListener('pm:focus', handle as EventListener);
      ctrlRef.current?.abort();
    };
  }, [rows, coords, setCoords, map, defaultZoom]);

  return null;
}

export default function MapOSM({
  open, // optional: controlled when provided
  endpoint = '/api/property_markers',
  height = 560,
  fallbackGeocode = true,
  throttleMs = 1100,
  defaultCenter = { lat: 39.8283, lng: -98.5795 },
  defaultZoom = 4,
}: {
  open?: boolean;
  endpoint?: string;
  height?: number;
  fallbackGeocode?: boolean;
  throttleMs?: number;
  defaultCenter?: LatLng;
  defaultZoom?: number;
}) {
  injectMapCss();

  // controlled/uncontrolled
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const controlled = typeof open === 'boolean';
  const isOpen = controlled ? (open as boolean) : internalOpen;

  // event wiring only when uncontrolled
  useEffect(() => {
    if (controlled) return;
    const toggle = () => setInternalOpen((v) => !v);
    const openEv = () => setInternalOpen(true);
    const closeEv = () => setInternalOpen(false);
    window.addEventListener('pm:map-toggle', toggle);
    window.addEventListener('pm:map-open', openEv);
    window.addEventListener('pm:map-close', closeEv);
    return () => {
      window.removeEventListener('pm:map-toggle', toggle);
      window.removeEventListener('pm:map-open', openEv);
      window.removeEventListener('pm:map-close', closeEv);
    };
  }, [controlled]);

  // broadcast current state
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('pm:map-state', { detail: { open: isOpen } }));
  }, [isOpen]);

  const [rows, setRows] = useState<MarkerInput[]>([]);
  const [coords, setCoords] = useState<Record<string | number, LatLng>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMarkers = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RawRow[];
      const m = normalize(data);

      const seed: Record<string | number, LatLng> = {};
      for (const r of m) {
        if (isLatLng(r) && false) {
          // no-op, placeholder to avoid accidental narrowing on the row itself
        }
        if (r.lat != null && r.lng != null) {
          seed[r.id] = { lat: r.lat, lng: r.lng };
        }
      }
      setRows(m);
      setCoords(seed);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load map data');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchMarkers();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  // background geocode missing coords
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

        const fullAddress = [r.address, r.city, r.state, r.zipcode].filter(Boolean).join(', ');
        const fallbackAddress = [r.city, r.state, r.zipcode].filter(Boolean).join(', ');

        try {
          let hit: LatLng | null = await geocodeAddress(fullAddress, ctrl.signal);
          if (!hit && fallbackAddress) hit = await geocodeAddress(fallbackAddress, ctrl.signal);

          if (isLatLng(hit) && !cancelled) {
            const value: LatLng = hit;
            setCoords((prev) => {
              const next: Record<string | number, LatLng> = { ...prev };
              next[r.id] = value;
              return next;
            });
          }
        } catch {
          // ignore
        }

        if (i < need.length - 1) {
          await new Promise((res) => setTimeout(res, throttleMs));
        }
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
          const fullAddr =
            [r.address ?? '', r.city ?? '', r.state ?? '', r.zipcode ?? ''].filter(Boolean).join(', ') ||
            [r.city ?? '', r.state ?? '', r.zipcode ?? ''].filter(Boolean).join(', ') ||
            (r.address ?? '') ||
            '';
          const pos = coords[r.id];
          return pos ? { id: r.id, name: r.name, addr: fullAddr, pos } : null;
        })
        .filter(Boolean) as Array<{ id: string | number; name: string; addr: string; pos: LatLng }>,
    [rows, coords],
  );

  const points = markers.map((m) => m.pos);

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="map-wrap"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ opacity: { duration: 0.18 }, height: { duration: 0.28, ease: 'easeOut' } }}
          style={{ overflow: 'hidden', margin: 0 }}
        >
          <div
            style={{
              width: APP_WIDTH,
              margin: '0 auto',
              border: '1px solid #111',
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.45)',
              overflow: 'hidden',
              background: '#fff',
            }}
          >
            <div style={{ width: '100%', height }}>
              <MapContainer center={defaultCenter} zoom={defaultZoom} style={{ width: '100%', height: '100%' }} worldCopyJump>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBoundsOnce points={points} />
                <FocusOnProperty rows={rows} coords={coords} setCoords={setCoords} defaultZoom={16} />
                {markers.map((m) => (
                  <Marker key={m.id} position={m.pos} icon={DefaultIcon} zIndexOffset={1000}>
                    <Popup className="pm-popup" maxWidth={460} minWidth={280} keepInView autoPanPadding={[40, 40]}>
                      <div className="pm-title">{m.name}</div>
                      <div className="pm-addr">{m.addr}</div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            <div style={{ padding: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                {error
                  ? `Error: ${error}`
                  : loading || refreshing
                  ? 'Loading map…'
                  : markers.length === 0
                  ? 'No mappable properties yet.'
                  : `${markers.length} location${markers.length === 1 ? '' : 's'} plotted.`}
              </div>
              <button
                onClick={fetchMarkers}
                disabled={loading || refreshing}
                title="Refresh markers"
                style={{
                  border: '1px solid #111',
                  background: '#fff',
                  cursor: loading || refreshing ? 'not-allowed' : 'pointer',
                  padding: '6px 10px',
                  fontWeight: 700,
                  lineHeight: 1,
                  userSelect: 'none',
                }}
              >
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
