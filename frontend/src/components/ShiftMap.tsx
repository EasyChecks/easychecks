'use client';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';

// Use explicit icon with CDN URLs — avoids the webpack _getIconUrl undefined bug
const markerIcon = new L.Icon({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface ShiftMapProps {
  latitude: number;
  longitude: number;
  radius: number;
  locationName: string;
}

export default function ShiftMap({ latitude, longitude, radius, locationName }: ShiftMapProps) {
  return (
    <div className="relative h-56 rounded-xl overflow-hidden border border-gray-200">
      <MapContainer
        center={[latitude, longitude]}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Marker position={[latitude, longitude]} icon={markerIcon} title={locationName} />
        <Circle
          center={[latitude, longitude]}
          radius={radius}
          pathOptions={{ color: 'orange', fillColor: 'orange', fillOpacity: 0.15 }}
        />
      </MapContainer>
    </div>
  );
}
