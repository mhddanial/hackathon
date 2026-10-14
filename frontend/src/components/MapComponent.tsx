"use client";

import { useEffect, useId } from "react";
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
const destIcon = createCustomIcon("bg-emerald-600");

// Component to handle dynamic map bounds
function BoundsUpdater({ coordinates }: { coordinates: [number, number][] | null }) {
  const map = useMap();
  
  useEffect(() => {
    const resize = () => {
      map.invalidateSize({ pan: false });
      if (coordinates && coordinates.length > 0) map.fitBounds(L.latLngBounds(coordinates), { padding: [30, 30], maxZoom: 15, animate: false });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [coordinates, map]);

  return null;
}

export default function MapComponent({ 
  routeCoordinates = null,
  origin,
  destination,
  originName = "Origin",
  destName = "Destination",
  approximate = false,
}: { 
  routeCoordinates?: [number, number][] | null,
  origin?: [number, number],
  destination?: [number, number],
  originName?: string,
  destName?: string,
  approximate?: boolean,
}) {
  const mapId = useId();
  if (!origin || !destination) return <div className="p-4 text-sm">Location coordinates unavailable.</div>;

  return (
    <MapContainer
      key={mapId}
      center={origin}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      zoomControl={true}
      attributionControl={true}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      <Marker position={origin} icon={originIcon} title={originName} alt={originName}>
        <Tooltip direction="top" offset={[0, -15]} opacity={1}>
          {originName}
        </Tooltip>
      </Marker>
      
      <Marker position={destination} icon={destIcon} title={destName} alt={destName}>
        <Tooltip direction="top" offset={[0, -15]} opacity={1}>
          {destName}
        </Tooltip>
      </Marker>

      {routeCoordinates && routeCoordinates.length > 0 ? (
        <>
          <Polyline
            positions={routeCoordinates}
            pathOptions={{ color: approximate ? "#b45309" : "#0064e0", weight: 5, opacity: 0.9, ...(approximate ? { dashArray: "8, 8" } : {}) }}
          />
        </>
      ) : null}
      <BoundsUpdater coordinates={[origin, destination, ...(routeCoordinates || [])]} />
    </MapContainer>
  );
}
