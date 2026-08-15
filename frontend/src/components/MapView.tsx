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

      {/* Bottom Action Bar */}
      <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur shadow-lg rounded-[32px] p-4 flex items-center justify-between border border-border z-10">
        
        {/* Progress Tracker */}
        <div className="flex-1 px-4">
           <div className="h-1.5 w-full bg-border rounded-full overflow-hidden mb-2">
              <div className="h-full bg-primary w-1/2 rounded-full"></div>
           </div>
           <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
              <span className="text-muted-foreground">Preparing</span>
              <span className="text-primary">In Transit</span>
              <span className="text-muted-foreground">Arriving <span className="text-primary">Soon</span></span>
           </div>
        </div>

        <div className="flex items-center gap-3 ml-8 pointer-events-auto">
          <Button variant="outline" className="px-8 font-bold border-foreground text-foreground hover:bg-foreground hover:text-background">
            SHARE ROUTE
          </Button>
          <Button className="px-8 font-bold">
            CONFIRM SELECTION
            <CheckCircle2 className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
