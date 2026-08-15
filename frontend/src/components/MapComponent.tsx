"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Create custom icons using DivIcon for modern styling
const createCustomIcon = (colorClass: string) => {
  return L.divIcon({
    className: "bg-transparent border-none",
    html: `<div class="w-6 h-6 rounded-full shadow-md flex items-center justify-center bg-white border-2 border-white">
             <div class="w-3 h-3 rounded-full ${colorClass}"></div>
           </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const originIcon = createCustomIcon("bg-primary");
const destIcon = createCustomIcon("bg-primary-deep");

const BATAM_CENTER: [number, number] = [1.1291, 104.0494];
const BATU_AMPAR: [number, number] = [1.1633, 104.0044];

// Component to handle dynamic map bounds
function BoundsUpdater({ coordinates }: { coordinates: [number, number][] | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coordinates, map]);

  return null;
}

export default function MapComponent({ 
  routeCoordinates = null,
  origin = BATAM_CENTER,
  destination = BATU_AMPAR,
  originName = "Origin",
  destName = "Destination"
}: { 
  routeCoordinates?: [number, number][] | null,
  origin?: [number, number],
  destination?: [number, number],
  originName?: string,
  destName?: string
}) {
  const [mounted, setMounted] = useState(false);
  const [mapId, setMapId] = useState("");

  useEffect(() => {
    setMapId(`map-${Math.random().toString(36).substring(2, 9)}`);
    setMounted(true);
  }, []);

  if (!mounted || !mapId) return null;

  return (
    <MapContainer
      key={mapId}
      center={[1.1462, 104.0269]}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      <Marker position={origin} icon={originIcon}>
        <Tooltip direction="right" offset={[15, 0]} opacity={1} permanent>
          {originName}
        </Tooltip>
      </Marker>
      
      <Marker position={destination} icon={destIcon}>
        <Tooltip direction="right" offset={[15, 0]} opacity={1} permanent>
          {destName}
        </Tooltip>
      </Marker>

      {routeCoordinates && routeCoordinates.length > 0 ? (
        <>
          <Polyline
            positions={routeCoordinates}
            pathOptions={{ color: "#0064e0", weight: 5, opacity: 0.9 }}
          />
          <BoundsUpdater coordinates={routeCoordinates} />
        </>
      ) : (
        <>
          {/* Default Mock Routes if no data is provided */}
          <Polyline
            positions={[BATAM_CENTER, [1.1400, 104.0300], [1.1550, 104.0150], BATU_AMPAR]}
            pathOptions={{ color: "#0064e0", weight: 4, opacity: 0.8 }}
          />
          <Polyline
            positions={[BATAM_CENTER, [1.1350, 104.0200], [1.1480, 104.0080], BATU_AMPAR]}
            pathOptions={{ color: "#f7b928", weight: 4, opacity: 0.5, dashArray: "10, 10" }}
          />
        </>
      )}
    </MapContainer>
  );
}
