"use client";

import { useEffect, useRef, useCallback, useState, Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EventData, LocationData } from '@/types/event';

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

// Pending marker: green pulsing "+" — click to open add form
const pendingIcon = typeof window !== 'undefined' ? L.divIcon({
  className: '',
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -28],
  html: `
    <div style="width:48px;height:48px;position:relative;cursor:pointer">
      <style>
        @keyframes gp{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(2.2);opacity:0}}
        .gpr{position:absolute;inset:0;border-radius:50%;border:2px solid #16a34a;animation:gp 1.8s ease-out infinite}
        .gpr2{animation-delay:.9s}
      </style>
      <div class="gpr"></div><div class="gpr gpr2"></div>
      <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style="position:relative">
        <defs><filter id="gpf"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(22,163,74,0.5)"/></filter></defs>
        <circle cx="24" cy="24" r="16" fill="#16a34a" filter="url(#gpf)"/>
        <circle cx="24" cy="24" r="12" fill="none" stroke="white" stroke-width="1.5" stroke-opacity="0.35"/>
        <path stroke="white" stroke-width="2.5" stroke-linecap="round" d="M24 16v16M16 24h16"/>
      </svg>
    </div>`,
}) : null;

// ── Search types ─────────────────────────────────────────────────
interface SearchResult {
  id: string;
  type: 'location' | 'place';
  label: string;
  sublabel?: string;
  lat: number;
  lng: number;
}

interface FlyTarget {
  lat: number;
  lng: number;
  zoom: number;
  seq: number;
}

// ── FlyToController: must be inside MapContainer ─────────────────
function FlyToController({ target }: { target: FlyTarget | null }) {
  const map = useMap();
  const lastSeq = useRef<number>(-1);
  useEffect(() => {
    if (!target || target.seq === lastSeq.current) return;
    lastSeq.current = target.seq;
    map.flyTo([target.lat, target.lng], target.zoom, { duration: 1, easeLinearity: 0.3 });
  }, [map, target]);
  return null;
}

// ── Map search overlay (rendered outside MapContainer) ────────────
function MapSearchOverlay({
  locations,
  onSelect,
}: {
  locations: LocationData[];
  onSelect: (result: SearchResult) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    const localMatches: SearchResult[] = locations
      .filter(loc =>
        loc.locationName.toLowerCase().includes(q.toLowerCase()) ||
        (loc.department || '').toLowerCase().includes(q.toLowerCase())
      )
      .slice(0, 4)
      .map(loc => ({
        id: `loc-${loc.id}`,
        type: 'location' as const,
        label: loc.locationName,
        sublabel: loc.department || `${Number(loc.latitude).toFixed(5)}, ${Number(loc.longitude).toFixed(5)}`,
        lat: Number(loc.latitude),
        lng: Number(loc.longitude),
      }));

    let nominatimResults: SearchResult[] = [];
    try {
      setLoading(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=TH&addressdetails=1`,
        { headers: { 'Accept-Language': 'th,en' } }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any[] = await res.json();
      nominatimResults = data.map(item => ({
        id: `nom-${item.place_id}`,
        type: 'place' as const,
        label: item.display_name.split(',')[0],
        sublabel: item.display_name.split(',').slice(1, 3).join(',').trim(),
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }));
    } catch { /* ignore */ } finally { setLoading(false); }

    const combined = [
      ...localMatches,
      ...nominatimResults.filter(n => !localMatches.some(l => Math.abs(l.lat - n.lat) < 0.0001 && Math.abs(l.lng - n.lng) < 0.0001)),
    ].slice(0, 8);
    setResults(combined);
    setOpen(combined.length > 0);
  }, [locations]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => search(val), 450);
  };

  const handleSelect = (result: SearchResult) => {
    setQuery(result.label);
    setOpen(false);
    onSelect(result);
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-3 left-17.5 z-1000"
      style={{ width: 'min(290px, calc(100% - 160px))' }}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <div className="relative flex items-center bg-white rounded-xl shadow-lg border border-gray-200">
        <svg className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="ค้นหาสถานที่..."
          className="w-full pl-9 pr-8 py-2.5 text-sm bg-transparent rounded-xl focus:outline-none"
        />
        {loading && (
          <svg className="absolute right-3 w-3.5 h-3.5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {!loading && query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            className="absolute right-2.5 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="mt-1.5 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          {results.map(result => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
            >
              <span className="mt-0.5 shrink-0">
                {result.type === 'location' ? (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100">
                    <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                  </span>
                ) : (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100">
                    <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-gray-800 truncate">{result.label}</span>
                {result.sublabel && <span className="block text-xs text-gray-400 truncate">{result.sublabel}</span>}
                {result.type === 'location' && (
                  <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full leading-none">พื้นที่เช็คอิน</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Custom map icons ────────────────────────────────────────────
const eventIcon = typeof window !== 'undefined' ? L.divIcon({
  className: '',
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -44],
  html: `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg"
    style="filter:drop-shadow(0 3px 6px rgba(194,65,12,0.5))">
    <path d="M16 2C8.27 2 2 8.27 2 16c0 9.94 14 28 14 28S30 25.94 30 16C30 8.27 23.73 2 16 2z" fill="#ea580c"/>
    <circle cx="16" cy="16" r="5" fill="white"/>
  </svg>`,
}) : null;

const locationIcon = typeof window !== 'undefined' ? L.divIcon({
  className: '',
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -44],
  html: `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg"
    style="filter:drop-shadow(0 3px 6px rgba(29,78,216,0.5))">
    <path d="M16 2C8.27 2 2 8.27 2 16c0 9.94 14 28 14 28S30 25.94 30 16C30 8.27 23.73 2 16 2z" fill="#2563eb"/>
    <circle cx="16" cy="16" r="5" fill="white"/>
  </svg>`,
}) : null;

const selectedIcon = typeof window !== 'undefined' ? L.divIcon({
  className: '',
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -28],
  html: `
    <div style="width:48px;height:48px;position:relative">
      <style>
        @keyframes sp{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(2.1);opacity:0}}
        .sr1{position:absolute;inset:0;border-radius:50%;border:2px solid #ef4444;animation:sp 2s ease-out infinite}
        .sr2{animation-delay:.75s}
      </style>
      <div class="sr1"></div><div class="sr1 sr2"></div>
      <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style="position:relative">
        <defs><filter id="sf"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(185,28,28,0.45)"/></filter></defs>
        <circle cx="24" cy="24" r="16" fill="#dc2626" filter="url(#sf)"/>
        <circle cx="24" cy="24" r="12" fill="none" stroke="white" stroke-width="1.5" stroke-opacity="0.4"/>
        <g stroke="white" stroke-width="2" stroke-linecap="round">
          <line x1="24" y1="11" x2="24" y2="16"/><line x1="24" y1="32" x2="24" y2="37"/>
          <line x1="11" y1="24" x2="16" y2="24"/><line x1="32" y1="24" x2="37" y2="24"/>
        </g>
        <circle cx="24" cy="24" r="3.5" fill="white"/>
      </svg>
    </div>`,
}) : null;

interface EventMapProps {
  events: EventData[];
  locations: LocationData[];
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
  selectedPosition?: { lat: number; lng: number };
  /** Green pulsing marker — click it to open the add-location form */
  pendingPosition?: { lat: number; lng: number };
  /** Fired when user clicks the pendingPosition marker */
  onPendingMarkerClick?: () => void;
  /** If true, clicking the map also flies to the clicked point */
  flyOnClick?: boolean;
  /** Imperatively fly to a position. Increment `seq` each time to trigger. */
  flyTo?: { lat: number; lng: number; zoom?: number; seq: number };
  /** Custom default center for map */
  defaultCenter?: { lat: number; lng: number };
}

function MapCapture({ onMap }: { onMap: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onMap(map); }, [map, onMap]);
  return null;
}

function MapClickHandler({
  onMapClick,
  isActive,
  onFlyTo,
  flyOnClick,
}: {
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
  isActive: boolean;
  onFlyTo?: (latlng: { lat: number; lng: number }) => void;
  flyOnClick?: boolean;
}) {
  useMapEvents({
    click: (e) => {
      if (!isActive) return;
      if (onMapClick) onMapClick(e.latlng);
      if (flyOnClick && onFlyTo) onFlyTo(e.latlng);
    },
  });
  return null;
}

export default function EventMap({
  events,
  locations,
  onMapClick,
  selectedPosition,
  pendingPosition,
  onPendingMarkerClick,
  flyOnClick,
  flyTo,
  defaultCenter: customDefaultCenter,
}: EventMapProps) {
  const defaultCenter: [number, number] = customDefaultCenter &&
    typeof customDefaultCenter.lat === 'number' &&
    typeof customDefaultCenter.lng === 'number' &&
    !isNaN(customDefaultCenter.lat) &&
    !isNaN(customDefaultCenter.lng)
    ? [customDefaultCenter.lat, customDefaultCenter.lng]
    : [13.7606, 100.5034];

  const allPoints: [number, number][] = [
    ...events.map(e => [Number(e.latitude), Number(e.longitude)] as [number, number]),
    ...locations.map(l => [Number(l.latitude), Number(l.longitude)] as [number, number]),
  ];
  const pointsKey = allPoints.map(p => `${p[0]},${p[1]}`).join('|');

  const [map, setMap] = useState<L.Map | null>(null);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const flySeq = useRef(0);

  // External flyTo prop — triggered by parent incrementing seq
  const lastExternalSeq = useRef(-1);
  useEffect(() => {
    if (!flyTo || flyTo.seq === lastExternalSeq.current) return;
    lastExternalSeq.current = flyTo.seq;
    setFlyTarget({ lat: flyTo.lat, lng: flyTo.lng, zoom: flyTo.zoom ?? 16, seq: ++flySeq.current });
  }, [flyTo]);

  const onMapCapture = useCallback((m: L.Map) => setMap(m), []);
  const latestPoints = useRef<[number, number][]>(allPoints);
  latestPoints.current = allPoints;

  const doFit = useCallback((m: L.Map, pts: [number, number][]) => {
    m.invalidateSize();
    if (pts.length === 1) {
      m.setView(pts[0], 14);
    } else {
      m.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 15 });
    }
  }, []);

  useEffect(() => {
    if (!map) return;
    const pts = latestPoints.current;
    if (pts.length === 0) return;

    const tryFit = (): boolean => {
      const rect = map.getContainer().getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        doFit(map, latestPoints.current);
        return true;
      }
      return false;
    };

    if (tryFit()) return;
    let ticks = 0;
    const timer = setInterval(() => {
      if (tryFit() || ++ticks >= 20) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [map, pointsKey, doFit]);

  const handleFlyTo = useCallback((latlng: { lat: number; lng: number }) => {
    setFlyTarget({ lat: latlng.lat, lng: latlng.lng, zoom: 16, seq: ++flySeq.current });
  }, []);

  const handleSearchSelect = useCallback((result: SearchResult) => {
    const latlng = { lat: result.lat, lng: result.lng };
    setFlyTarget({ ...latlng, zoom: result.type === 'location' ? 16 : 15, seq: ++flySeq.current });
    if (onMapClick) onMapClick(latlng);
  }, [onMapClick]);

  const hintLabel = onMapClick
    ? pendingPosition
      ? 'คลิกที่หมุดสีเขียวเพื่อดำเนินการต่อ'
      : 'คลิกบนแผนที่เพื่อเลือกตำแหน่ง'
    : null;

  return (
    <div className="relative overflow-hidden border-2 border-gray-200 rounded-2xl shadow-sm">
      {/* Search overlay */}
      {onMapClick && (
        <MapSearchOverlay locations={locations} onSelect={handleSearchSelect} />
      )}

      <MapContainer center={defaultCenter} zoom={6} style={{ height: '500px', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapCapture onMap={onMapCapture} />
        <FlyToController target={flyTarget} />
        <MapClickHandler
          onMapClick={onMapClick}
          isActive={!!onMapClick}
          onFlyTo={handleFlyTo}
          flyOnClick={flyOnClick}
        />

        {/* Event markers */}
        {events?.map((event) => (
          <Fragment key={event.id}>
            {eventIcon && (
              <Marker position={[event.latitude, event.longitude]} icon={eventIcon}>
                <Popup className="custom-popup" minWidth={200}>
                  <div style={{ padding: '4px 2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#1f2937', lineHeight: 1.3 }}>{event.name}</span>
                    </div>
                    {event.locationName && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>📍 {event.locationName}</div>}
                    {event.startTime && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, padding: '3px 6px', background: '#fef9ef', borderRadius: 4 }}>
                        🕐 {event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}
                      </div>
                    )}
                    {event.radius && <div style={{ fontSize: 11, color: '#f97316', marginTop: 4 }}>รัศมี {event.radius} เมตร</div>}
                  </div>
                </Popup>
              </Marker>
            )}
            {event.radius && (
              <Circle
                center={[event.latitude, event.longitude]}
                radius={event.radius}
                pathOptions={{ color: '#f97316', weight: 2, dashArray: '6 4', fillColor: '#f97316', fillOpacity: 0.08 }}
              />
            )}
          </Fragment>
        ))}

        {/* Location markers */}
        {locations?.map((location) => (
          <Fragment key={location.id}>
            {locationIcon && (
              <Marker position={[location.latitude, location.longitude]} icon={locationIcon}>
                <Popup className="custom-popup" minWidth={200}>
                  <div style={{ padding: '4px 2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#1f2937', lineHeight: 1.3 }}>{location.locationName}</span>
                    </div>
                    {location.department && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>🏢 {location.department}</div>}
                    {location.radius && <div style={{ fontSize: 11, color: '#2563eb', marginTop: 4, padding: '3px 6px', background: '#eff6ff', borderRadius: 4 }}>รัศมีเช็คอิน {location.radius} เมตร</div>}
                  </div>
                </Popup>
              </Marker>
            )}
            {location.radius && (
              <Circle
                center={[location.latitude, location.longitude]}
                radius={location.radius}
                pathOptions={{ color: '#2563eb', weight: 2, dashArray: '6 4', fillColor: '#3b82f6', fillOpacity: 0.08 }}
              />
            )}
          </Fragment>
        ))}

        {/* Pending marker — green pulsing, click to open add form */}
        {pendingPosition && pendingIcon && (
          <Marker
            position={[pendingPosition.lat, pendingPosition.lng]}
            icon={pendingIcon}
            eventHandlers={{ click: () => onPendingMarkerClick?.() }}
          >
            <Popup className="custom-popup" minWidth={180}>
              <div style={{ padding: '4px 2px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d', marginBottom: 4 }}>ตำแหน่งที่เลือก</div>
                <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', marginBottom: 8 }}>
                  {pendingPosition.lat.toFixed(6)}, {pendingPosition.lng.toFixed(6)}
                </div>
                <div style={{ fontSize: 11, color: '#15803d', background: '#f0fdf4', borderRadius: 6, padding: '4px 8px', textAlign: 'center' }}>
                  คลิกหมุดนี้เพื่อเพิ่มพื้นที่เช็คอิน
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Selected position marker (for editing) */}
        {selectedPosition && selectedIcon && (
          <Marker position={[selectedPosition.lat, selectedPosition.lng]} icon={selectedIcon}>
            <Popup className="custom-popup" minWidth={200}>
              <div style={{ padding: '4px 2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#dc2626' }}>ตำแหน่งที่เลือก</span>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>
                  {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Hint badge */}
      {hintLabel && (
        <div className="absolute z-1000 top-3 right-3 px-3 py-2 text-xs font-semibold text-white rounded-lg shadow-lg bg-orange-600/90 backdrop-blur-sm flex items-center gap-1.5 pointer-events-none">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {hintLabel}
        </div>
      )}
    </div>
  );
}
