"use client";

import dynamic from "next/dynamic";
import { Building2, Ship } from "lucide-react";

// Dynamically import MapComponent to disable SSR
const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#E5F3F8] flex items-center justify-center">
      <div className="animate-pulse w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
    </div>
  ),
});

export default function MapView({
  routeCoordinates = null,
  originStr = "Origin",
  destStr = "Destination",
  originCoords,
  destCoords,
  approximate = false,
}: {
  routeCoordinates?: [number, number][] | null,
  originStr?: string,
  destStr?: string,
  originCoords?: [number, number],
  destCoords?: [number, number],
  approximate?: boolean,
}) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* The Actual Leaflet Map */}
      <div className="relative z-0 order-2 min-h-0 flex-1">
        <MapComponent 
          routeCoordinates={routeCoordinates} 
          origin={originCoords}
          destination={destCoords}
          originName={originStr}
          destName={destStr}
          approximate={approximate}
        />
      </div>
      
      {/* Endpoint labels occupy their own row so they cannot cover markers. */}
      <div className="order-1 grid shrink-0 grid-cols-2 gap-3 border-b bg-card p-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Origin</p>
            <p className="break-words text-xs font-semibold text-foreground sm:text-sm" title={originStr}>{originStr}</p>
          </div>
        </div>
        
        <div className="flex min-w-0 items-center justify-end gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Destination</p>
            <p className="break-words text-right text-xs font-semibold text-foreground sm:text-sm" title={destStr}>{destStr}</p>
          </div>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Ship className="w-4 h-4" />
          </div>
        </div>
      </div>

    </div>
  );
}
