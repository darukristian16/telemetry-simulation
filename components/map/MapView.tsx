"use client";

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Component to update map view when position changes
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

interface MapViewProps {
  position: [number, number];
  zoom?: number;
  height?: string;
  width?: string;
  showPopup?: boolean;
  popupContent?: React.ReactNode;
  className?: string;
}

export default function MapView({
  position,
  zoom = 13,
  height = '100%',
  width = '100%',
  showPopup = true,
  popupContent,
  className = '',
}: MapViewProps) {
  // State to track if component is mounted (for SSR compatibility)
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Fix Leaflet's icon paths
    if (typeof window !== 'undefined') {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl: '/leaflet/marker-icon.png',
        shadowUrl: '/leaflet/marker-shadow.png',
      });
    }
  }, []);

  if (!isMounted) {
    // Return a placeholder while the component is not yet mounted
    return (
      <div 
        className={`flex items-center justify-center bg-gray-700 text-gray-400 ${className}`}
        style={{ height, width }}
      >
        Loading map...
      </div>
    );
  }

  return (
    <MapContainer
      center={position}
      zoom={zoom}
      style={{ height, width }}
      className={`rounded-lg ${className}`}
    >
      <ChangeView center={position} zoom={zoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={position}>
        {showPopup && (
          <Popup>
            {popupContent || (
              <div>
                <div>Latitude: {position[0].toFixed(6)}</div>
                <div>Longitude: {position[1].toFixed(6)}</div>
              </div>
            )}
          </Popup>
        )}
      </Marker>
    </MapContainer>
  );
} 