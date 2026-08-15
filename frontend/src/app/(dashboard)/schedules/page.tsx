"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, MapPin, ChevronRight, Calendar, Ship, CheckCircle2, RefreshCw } from "lucide-react";

interface Schedule {
  id: string;
  terminal_name: string;
  destination: string;
  departure_times: string[];
  vessel_type: string;
  cargo_capacity_tons: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function FerrySchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/schedules`);
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch (error) {
      console.error("Failed to fetch schedules", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  // Derive trip count from real data
  const totalDailyTrips = schedules.reduce((acc, s) => acc + (s.departure_times?.length || 0), 0);

  return (
    <div className="flex flex-col bg-[#F8F9FB] rounded-tl-3xl p-8 overflow-y-auto min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <h1 className="text-[28px] font-semibold text-[#1A1D27]">Ferry Schedules</h1>
        <div className="flex gap-2">
          <Button onClick={fetchSchedules} variant="outline" className="rounded-lg px-4 h-10 bg-white border-[#E2E8F0] text-[#5E6470] hover:bg-slate-50 shadow-sm font-medium">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" className="rounded-lg px-4 h-10 bg-white border-[#E2E8F0] text-[#5E6470] hover:bg-slate-50 shadow-sm font-medium">
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-8">
        
        {/* Left Column */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Origin Terminal Card */}
          <Card className="rounded-[16px] p-2 shadow-sm border-[#E2E8F0] bg-[#F1F5F9] flex flex-col">
            <h2 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest px-4 py-3">ORIGIN TERMINAL</h2>
            
            <div className="bg-white rounded-[12px] flex items-center justify-between p-4 shadow-sm relative cursor-pointer mb-1">
              <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#2563EB] rounded-r-md"></div>
              <span className="font-bold text-sm text-[#1A1D27] pl-3">Batam Center (Main)</span>
              <ChevronRight className="w-4 h-4 text-[#2563EB]" />
            </div>
            
            <div className="rounded-[12px] flex items-center justify-between p-4 cursor-pointer hover:bg-white/50 transition-colors">
              <span className="font-medium text-sm text-[#5E6470]">Sekupang Terminal</span>
            </div>
            
            <div className="rounded-[12px] flex items-center justify-between p-4 cursor-pointer hover:bg-white/50 transition-colors">
              <span className="font-medium text-sm text-[#5E6470]">Batu Ampar Port</span>
            </div>
          </Card>

          {/* Terminal Info Card */}
          <Card className="rounded-[16px] overflow-hidden shadow-sm border-[#E2E8F0] bg-white flex flex-col">
            <div className="h-[200px] w-full relative">
              <img 
                src="https://images.unsplash.com/photo-1559061036-7cbdfaee6d1d?q=80&w=800&auto=format&fit=crop" 
                alt="Batam Center Port" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-5 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-bold text-[#1A1D27] mb-1">Batam Center</h3>
              <div className="flex items-center text-[#5E6470]">
                <MapPin className="w-3.5 h-3.5 mr-1" />
                <p className="text-xs font-medium">Jl. Engku Putri, Batam</p>
              </div>
            </div>
            <div className="flex bg-white">
              <div className="flex-1 p-4 text-center">
                <span className="text-[20px] font-bold text-[#2563EB] block mb-1">
                  {loading ? "--" : totalDailyTrips}
                </span>
                <span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">DAILY TRIPS</span>
              </div>
              <div className="flex-1 p-4 text-center border-l border-[#E2E8F0]">
                <span className="text-[20px] font-bold text-[#2563EB] block mb-1">--</span>
                <span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">ON-TIME</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8 flex flex-col">
          <Card className="rounded-[16px] shadow-sm border-[#E2E8F0] bg-white flex flex-col overflow-hidden w-full">
            {/* Top Controls */}
            <div className="flex justify-between items-center p-4 border-b border-[#E2E8F0]">
              <div className="flex items-center bg-[#F1F5F9] rounded-lg p-1">
                <div className="bg-white px-4 py-2 rounded-md shadow-sm cursor-pointer">
                  <span className="text-xs font-semibold text-[#1A1D27]">All Destinations</span>
                </div>
              </div>
              <div className="flex items-center bg-[#F1F5F9] px-4 py-2.5 rounded-lg border border-[#E2E8F0] cursor-pointer">
                <Calendar className="w-4 h-4 text-[#5E6470] mr-2" />
                <span className="text-xs font-medium text-[#1A1D27]">{new Date().toLocaleDateString()}</span>
              </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Table Header */}
                <div className="grid grid-cols-8 gap-4 px-6 py-4 bg-[#F8F9FB] border-b border-[#E2E8F0] text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">
                  <div>DEPARTURE</div>
                  <div>CUT-OFF</div>
                  <div className="col-span-2">VESSEL / OPERATOR</div>
                  <div>DESTINATION</div>
                  <div>CAPACITY</div>
                  <div className="col-span-2 text-right">STATUS</div>
                </div>
                
                {/* Rows */}
                {loading ? (
                  <div className="p-8 flex justify-center items-center text-[#5E6470]">
                    <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                    Loading schedules...
                  </div>
                ) : schedules.length > 0 ? (
                  schedules.map((schedule, idx) => (
                    (schedule.departure_times || []).map((time, tIdx) => (
                      <div key={`${schedule.id}-${tIdx}`} className="grid grid-cols-8 gap-4 px-6 py-5 border-b border-[#E2E8F0] items-center">
                        <div>
                          <p className="text-sm font-bold text-[#1A1D27]">{time}</p>
                          <p className="text-[10px] text-[#5E6470] mt-1">Boarding: -15m</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#EF4444]">STRICT</p>
                        </div>
                        <div className="col-span-2 flex items-center gap-3">
                          <Ship className="w-4 h-4 text-[#1A1D27]" />
                          <div>
                            <p className="text-sm font-bold text-[#1A1D27]">{schedule.vessel_type}</p>
                            <p className="text-[11px] text-[#94A3B8]">{schedule.terminal_name}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1A1D27]">{schedule.destination}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1A1D27]">{schedule.cargo_capacity_tons} Tons</p>
                        </div>
                        <div className="col-span-2 text-right flex justify-end">
                          <div className="bg-[#D1FAE5] border border-[#A7F3D0] rounded-md px-3 py-1 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                            <span className="text-[10px] font-bold text-[#065F46] uppercase">AVAILABLE</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ))
                ) : (
                  <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
                    <Ship className="w-10 h-10 text-[#CBD5E1]" />
                    <p className="text-sm font-semibold text-[#64748B]">No schedules available</p>
                    <p className="text-xs text-[#94A3B8]">The backend returned no ferry schedules. Try refreshing.</p>
                    <Button onClick={fetchSchedules} variant="outline" size="sm" className="mt-2 rounded-lg">
                      <RefreshCw className="w-3 h-3 mr-2" /> Retry
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
