"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, MapPin, Search, ChevronDown, Clock, Leaf, Target, Layers, Loader2 } from "lucide-react";
import MapView from "@/components/MapView";

export default function RouteRecommendationPage() {
  const [origin, setOrigin] = useState("1.1291, 104.0494");
  const [destination, setDestination] = useState("1.1633, 104.0044");
  const [cargoType, setCargoType] = useState("electronics");
  const [priority, setPriority] = useState("balanced");
  
  const [loading, setLoading] = useState(false);
  const [routeData, setRouteData] = useState<any>(null);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const [originLat, originLng] = origin.split(",").map(s => parseFloat(s.trim()));
      const [destLat, destLng] = destination.split(",").map(s => parseFloat(s.trim()));
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      
      const res = await fetch(`${API_URL}/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: [originLat, originLng],
          destination: [destLat, destLng],
          departure_hour: new Date().getHours(),
          day_type: "weekday",
          cargo_type: cargoType
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setRouteData(data);
      }
    } catch (e) {
      console.error("Failed to fetch route:", e);
    } finally {
      setLoading(false);
    }
  };

  // Convert GeoJSON to Polyline coordinates format ([lat, lng][])
  const routeCoordinates = routeData?.geometry?.coordinates?.map((coord: number[]) => [coord[1], coord[0]]) || null;

  return (
    <div className="flex flex-col bg-[#F8F9FB] rounded-tl-3xl p-8 overflow-y-auto min-h-screen">
      
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-[28px] font-semibold text-[#1A1D27] mb-1">Route Recommendation</h1>
          <p className="text-sm text-[#5E6470]">Optimize your logistics path for speed, cost, and reduced emission impact.</p>
        </div>
        <Button className="rounded-lg px-4 h-10 bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-sm font-medium">
          <Plus className="w-4 h-4 mr-2" />
          Add New
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-8">
        
        {/* Left Column */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Parameters Card */}
          <Card className="rounded-[16px] p-6 shadow-sm border-[#E2E8F0] bg-white flex flex-col">
            <h2 className="text-[20px] font-semibold text-[#1A1D27] mb-6">Parameters</h2>
            
            <div className="relative pl-8 mb-6">
              {/* Vertical line */}
              <div className="absolute left-[15px] top-6 bottom-6 w-0.5 bg-[#E2E8F0]"></div>
              
              {/* First Location */}
              <div className="mb-6 relative">
                <div className="absolute -left-[35px] top-[22px] w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
                  <MapPin className="w-4 h-4" />
                </div>
                <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5 block">ORIGIN (LAT, LNG)</label>
                <div className="flex items-center justify-between border border-[#E2E8F0] rounded-lg px-4 py-2.5 bg-white">
                  <input 
                    type="text" 
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="text-sm font-medium text-[#1A1D27] bg-transparent outline-none w-full"
                  />
                  <Target className="w-4 h-4 text-[#94A3B8]" />
                </div>
              </div>
              
              {/* Destination */}
              <div className="relative">
                <div className="absolute -left-[35px] top-[22px] w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[#64748B]">
                  <MapPin className="w-4 h-4" />
                </div>
                <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5 block">DESTINATION (LAT, LNG)</label>
                <div className="flex items-center justify-between border border-[#E2E8F0] rounded-lg px-4 py-2.5 bg-white">
                  <input 
                    type="text" 
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="text-sm font-medium text-[#1A1D27] bg-transparent outline-none w-full"
                  />
                  <Search className="w-4 h-4 text-[#94A3B8]" />
                </div>
              </div>
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5 block">CARGO TYPE</label>
                <div className="flex items-center justify-between border border-[#E2E8F0] rounded-lg px-3 py-2.5 bg-white">
                  <span className="text-sm font-medium text-[#1A1D27] capitalize">{cargoType}</span>
                  <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5 block">PRIORITY</label>
                <div className="flex items-center justify-between border border-[#E2E8F0] rounded-lg px-3 py-2.5 bg-white">
                  <span className="text-sm font-medium text-[#1A1D27] capitalize">{priority}</span>
                  <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                </div>
              </div>
            </div>
            
            <Button onClick={handleSearch} disabled={loading} className="w-full rounded-lg h-12 bg-[#2563EB] text-white hover:bg-[#1D4ED8] font-bold">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "FIND ROUTE"}
            </Button>
          </Card>

          {/* Mini Cards Row */}
          <div className="grid grid-cols-2 gap-6">
            
            {/* Departure Window */}
            <Card className="rounded-[16px] p-6 shadow-sm border-[#E2E8F0] bg-white flex flex-col justify-between h-full">
              <div>
                <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#1A1D27] mb-4">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-[#1A1D27] leading-tight mb-2">Distance<br/>Overview</h3>
                <p className="text-xs text-[#5E6470]">Physical distance vs duration.</p>
              </div>
              <div className="mt-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-[32px] font-bold text-[#1A1D27] leading-none">
                    {routeData ? `${routeData.distance_km.toFixed(1)}` : "--"}
                  </span>
                  <span className="text-sm font-bold text-[#10B981]">KM</span>
                </div>
                <div className="flex items-center border-l-2 border-[#10B981] pl-2 mt-2">
                  <span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">
                    {routeData ? `~${routeData.estimated_duration_min.toFixed(0)} MINS` : "AWAITING ROUTE"}
                  </span>
                </div>
              </div>
            </Card>

            {/* Impact Card (Dark) */}
            <Card className="rounded-[16px] p-6 shadow-sm border-none bg-[#0F172A] flex flex-col justify-between h-full relative">
              <div className="flex justify-between items-start mb-6">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                  <Leaf className="w-5 h-5" />
                </div>
                <div className="bg-[#10B981] text-white font-bold text-[9px] uppercase tracking-widest px-3 py-1 rounded-full">
                  {routeData?.emission_score || "UNKNOWN"}
                </div>
              </div>
              
              <div>
                <h3 className="text-[20px] font-semibold text-white mb-1">Congestion</h3>
                <p className="text-xs text-[#93C5FD]">Traffic multiplier applied to this route.</p>
              </div>
              
              <div className="mt-6 flex justify-between items-end">
                <div>
                  <span className="text-[36px] font-bold text-white leading-none block mb-1">
                    {routeData ? `x${routeData.congestion_multiplier}` : "-"}
                  </span>
                  <span className="text-[9px] font-bold text-white uppercase tracking-widest">MULTIPLIER</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Main Map Area */}
          <div className="flex-1 rounded-[16px] overflow-hidden relative shadow-sm border-[#E2E8F0] min-h-[400px] bg-white">
            <MapView 
              routeCoordinates={routeCoordinates}
              originStr={origin}
              destStr={destination}
              originCoords={origin.split(',').length === 2 ? [parseFloat(origin.split(',')[0]), parseFloat(origin.split(',')[1])] : undefined}
              destCoords={destination.split(',').length === 2 ? [parseFloat(destination.split(',')[0]), parseFloat(destination.split(',')[1])] : undefined}
            />
          </div>

          {/* Bottom Summary Bar */}
          <Card className="rounded-[16px] p-6 shadow-sm border-[#E2E8F0] bg-white flex justify-between items-center">
            
            <div className="flex gap-12">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">EST. DURATION</span>
                <span className="text-2xl font-bold text-[#1A1D27]">
                  {routeData ? `${routeData.estimated_duration_min.toFixed(0)} min` : "--"}
                </span>
              </div>
              
              <div className="w-px h-10 bg-[#E2E8F0]"></div>
              
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">DISTANCE</span>
                <span className="text-2xl font-bold text-[#1A1D27]">
                  {routeData ? `${routeData.distance_km.toFixed(1)} km` : "--"}
                </span>
              </div>
              
              <div className="w-px h-10 bg-[#E2E8F0]"></div>
              
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">EMISSION RATING</span>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${routeData?.emission_score === 'Low' ? 'text-[#10B981]' : routeData?.emission_score === 'Medium' ? 'text-amber-500' : 'text-red-500'}`}>
                    {routeData ? routeData.emission_score : "--"}
                  </span>
                </div>
              </div>
            </div>

            <Button className="rounded-lg px-8 h-12 font-semibold text-sm bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-sm">
              CONFIRM ROUTE
            </Button>
          </Card>

        </div>

      </div>
    </div>
  );
}
