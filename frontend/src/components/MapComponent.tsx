"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from "react-leaflet";
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
const BATU_AMPAR: [number, number] = [1.1633, 104.0044]; // Approximate coordinate

export default function MapComponent() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <MapContainer
      center={[1.1462, 104.0269]} // Center between origin and destination
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
      attributionControl={false}
    >
      {/* Light, clean tile layer matching DESIGN.md's stark white canvas */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      <Marker position={BATAM_CENTER} icon={originIcon}>
        <Tooltip direction="right" offset={[15, 0]} opacity={1} permanent>
          Batam Warehouse
        </Tooltip>
      </Marker>
      
      <Marker position={BATU_AMPAR} icon={destIcon}>
        <Tooltip direction="right" offset={[15, 0]} opacity={1} permanent>
          Batu Ampar Terminal
        </Tooltip>
      </Marker>

      {/* Primary Route */}
      <Polyline
        positions={[BATAM_CENTER, [1.1400, 104.0300], [1.1550, 104.0150], BATU_AMPAR]}
        pathOptions={{ color: "#0064e0", weight: 4, opacity: 0.8 }}
      />
      
      {/* Alternative Route (e.g. heavier traffic) */}
      <Polyline
        positions={[BATAM_CENTER, [1.1350, 104.0200], [1.1480, 104.0080], BATU_AMPAR]}
        pathOptions={{ color: "#f7b928", weight: 4, opacity: 0.5, dashArray: "10, 10" }}
      />
    </MapContainer>
  );
}
