"use client";

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EventData, LocationData } from '@/types/event';

// Fix Leaflet default marker icon issue
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

interface EventMapProps {
  events: EventData[];
  locations: LocationData[];
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
  selectedPosition?: { lat: number; lng: number };
}

// Component to handle map clicks
function MapClickHandler({ onMapClick, isActive }: { onMapClick?: (latlng: any) => void; isActive: boolean }) {
  useMapEvents({
    click: (e) => {
      if (isActive && onMapClick) {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
}

export default function EventMap({ events, locations, onMapClick, selectedPosition }: EventMapProps) {
  const defaultCenter: [number, number] = [13.7606, 100.5034]; // Bangkok
  const mapRef = useRef<L.Map | null>(null);

  // Auto-fit bounds when events change
  useEffect(() => {
    if (mapRef.current && events.length > 0) {
      const bounds = L.latLngBounds(
        events.map(event => [event.latitude, event.longitude] as [number, number])
      );
      mapRef.current.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 17
      });
    }
  }, [events]);

  return (
    <div className="relative overflow-hidden border-2 border-gray-200 rounded-2xl shadow-sm">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: '500px', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Map Click Handler */}
        <MapClickHandler onMapClick={onMapClick} isActive={!!onMapClick} />

        {/* Event Markers & Circles */}
        {events.map((event) => (
          <div key={event.id}>
            <Marker position={[event.latitude, event.longitude]}>
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold text-gray-900">{event.name}</h3>
                  <p className="text-sm text-gray-600">{event.locationName}</p>
                  {event.startTime && (
                    <p className="text-xs text-gray-500">{event.startTime} - {event.endTime}</p>
                  )}
                </div>
              </Popup>
            </Marker>
            {event.radius && (
              <Circle
                center={[event.latitude, event.longitude]}
                radius={event.radius}
                pathOptions={{
                  color: '#f97316',
                  fillColor: '#fed7aa',
                  fillOpacity: 0.2
                }}
              />
            )}
          </div>
        ))}

        {/* Location Markers */}
        {locations.map((location) => (
          <div key={location.id}>
            <Marker 
              position={[location.latitude, location.longitude]}
              icon={new L.Icon({
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41]
              })}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold text-blue-900">{location.locationName}</h3>
                  {location.department && (
                    <p className="text-sm text-gray-600">{location.department}</p>
                  )}
                </div>
              </Popup>
            </Marker>
            {location.radius && (
              <Circle
                center={[location.latitude, location.longitude]}
                radius={location.radius}
                pathOptions={{
                  color: '#3b82f6',
                  fillColor: '#93c5fd',
                  fillOpacity: 0.2
                }}
              />
            )}
          </div>
        ))}

        {/* Selected Position Marker */}
        {selectedPosition && (
          <Marker 
            position={[selectedPosition.lat, selectedPosition.lng]}
            icon={new L.Icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41]
            })}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-bold text-red-600">ตำแหน่งที่เลือก</h3>
                <p className="text-xs text-gray-500">
                  Lat: {selectedPosition.lat.toFixed(6)}<br />
                  Lng: {selectedPosition.lng.toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Click instruction overlay */}
      {onMapClick && (
        <div className="absolute z-[1000] px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-lg top-4 right-4 bg-orange-600">
          <svg className="inline-block w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          คลิกบนแผนที่เพื่อเลือกตำแหน่ง
        </div>
      )}
    </div>
  );
}
