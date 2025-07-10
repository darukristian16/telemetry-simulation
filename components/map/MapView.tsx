"use client";

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Component to center map on current position when requested (preserves zoom)
function CenterControl({ position, shouldCenter, onCentered }: { 
  position: [number, number]; 
  shouldCenter: boolean; 
  onCentered: () => void; 
}) {
  const map = useMap();
  
  useEffect(() => {
    if (shouldCenter) {
      // Get current zoom level to preserve it
      const currentZoom = map.getZoom();
      map.setView(position, currentZoom);
      onCentered();
    }
  }, [shouldCenter, position, map, onCentered]);
  
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
  preserveView?: boolean; // New prop to control view preservation
  showCenterButton?: boolean; // New prop to show center button
}

export default function MapView({
  position,
  zoom = 13,
  height = '100%',
  width = '100%',
  showPopup = true,
  popupContent,
  className = '',
  preserveView = true, // Default to preserving view
  showCenterButton = true, // Default to showing center button
}: MapViewProps) {
  // State to track if component is mounted (for SSR compatibility)
  const [isMounted, setIsMounted] = useState(false);
  const [shouldCenter, setShouldCenter] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
    
    // Fix Leaflet's icon paths and CSS
    if (typeof window !== 'undefined') {
      // Remove default icon URL getter
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      
      // Set custom icon paths
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl: '/leaflet/marker-icon.png',
        shadowUrl: '/leaflet/marker-shadow.png',
      });
    }
  }, []);

  // Handle map ready event
  const handleMapReady = (map: L.Map) => {
    mapRef.current = map;
    setMapReady(true);
    
    // Force map to invalidate size after a brief delay
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 100);
  };

  const handleCenterClick = () => {
    setShouldCenter(true);
  };

  const handleCentered = () => {
    setShouldCenter(false);
  };

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
    <div 
      ref={containerRef}
      className="relative"
      style={{ height, width }}
    >
      <MapContainer
        center={position}
        zoom={zoom}
        style={{ 
          height: '100%', 
          width: '100%',
          minHeight: '200px' // Ensure minimum height
        }}
        className={`rounded-lg ${className}`}
        whenReady={handleMapReady}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        touchZoom={true}
        dragging={true}
      >
        {/* Only show center control if preserveView is enabled */}
        {preserveView && (
          <CenterControl 
            position={position} 
            shouldCenter={shouldCenter} 
            onCentered={handleCentered} 
          />
        )}
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          minZoom={1}
        />
        <Marker position={position}>
          {showPopup && (
            <Popup>
              {popupContent || (
                <div>
                  <div>Latitude: {position[0].toFixed(6)}</div>
                  <div>Longitude: {position[1].toFixed(6)}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Live location tracking
                  </div>
                </div>
              )}
            </Popup>
          )}
        </Marker>
      </MapContainer>
      
      {/* Center button to allow user to center on current position */}
      {showCenterButton && preserveView && (
        <button
          onClick={handleCenterClick}
          className="absolute top-2 right-2 z-[1000] bg-white border-2 border-gray-300 rounded-md p-2 shadow-lg hover:bg-gray-50 transition-colors"
          title="Center on current position"
        >
          <svg 
            className="w-4 h-4 text-gray-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
            />
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
            />
          </svg>
        </button>
      )}
    </div>
  );
} 