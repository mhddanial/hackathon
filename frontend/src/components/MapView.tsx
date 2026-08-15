"use client";

import dynamic from "next/dynamic";
import { Building2, Ship, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  originStr = "Batam Central Hub",
  destStr = "Batu Ampar Terminal",
  originCoords,
  destCoords
}: {
  routeCoordinates?: [number, number][] | null,
  originStr?: string,
  destStr?: string,
  originCoords?: [number, number],
  destCoords?: [number, number]
}) {
  return (
    <div className="w-full h-full relative">
      {/* The Actual Leaflet Map */}
      <div className="absolute inset-0 z-0">
        <MapComponent 
          routeCoordinates={routeCoordinates} 
          origin={originCoords}
          destination={destCoords}
          originName={originStr}
          destName={destStr}
        />
      </div>
      
      {/* Top Overlays */}
      <div className="absolute top-6 left-6 right-6 flex justify-between pointer-events-none z-10">
        <div className="bg-white/95 backdrop-blur shadow-sm px-6 py-4 rounded-full flex items-center gap-4 pointer-events-auto border border-border">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Origin</p>
            <p className="text-sm font-bold text-foreground">{originStr}</p>
          </div>
        </div>
        
        <div className="bg-white/95 backdrop-blur shadow-sm px-6 py-4 rounded-full flex items-center gap-4 pointer-events-auto border border-border">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Destination</p>
            <p className="text-sm font-bold text-foreground text-right">{destStr}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Ship className="w-4 h-4" />
          </div>
        </div>
      </div>

    </div>
  );
}
