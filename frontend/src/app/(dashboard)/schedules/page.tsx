"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, SlidersHorizontal, MapPin, ChevronRight, Calendar, Ship, CheckCircle2, AlertTriangle, Clock, ChevronDown } from "lucide-react";
import Link from "next/link";

export default function FerrySchedulesPage() {
  return (
    <div className="flex flex-col bg-[#F8F9FB] rounded-tl-3xl p-8 overflow-y-auto min-h-screen">
      


      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <h1 className="text-[28px] font-semibold text-[#1A1D27]">Ferry Schedules</h1>
        <Button variant="outline" className="rounded-lg px-4 h-10 bg-white border-[#E2E8F0] text-[#5E6470] hover:bg-slate-50 shadow-sm font-medium">
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Filter
        </Button>
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
                <span className="text-[20px] font-bold text-[#2563EB] block mb-1">24</span>
                <span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">DAILY TRIPS</span>
              </div>
              <div className="flex-1 p-4 text-center">
                <span className="text-[20px] font-bold text-[#2563EB] block mb-1">85%</span>
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
                <div className="px-4 py-2 cursor-pointer hover:bg-slate-200/50 rounded-md transition-colors">
                  <span className="text-xs font-medium text-[#5E6470]">PSA Keppel</span>
                </div>
                <div className="px-4 py-2 cursor-pointer hover:bg-slate-200/50 rounded-md transition-colors">
                  <span className="text-xs font-medium text-[#5E6470]">Changi</span>
                </div>
              </div>
              
              <div className="flex items-center bg-[#F1F5F9] px-4 py-2.5 rounded-lg border border-[#E2E8F0] cursor-pointer">
                <Calendar className="w-4 h-4 text-[#5E6470] mr-2" />
                <span className="text-xs font-medium text-[#1A1D27]">10/27/2023</span>
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
                  <div>EST. ARRIVAL</div>
                  <div>CAPACITY</div>
                  <div className="text-right">STATUS</div>
                </div>
                
                {/* Rows */}
                {/* Row 1 */}
                <div className="grid grid-cols-8 gap-4 px-6 py-5 border-b border-[#E2E8F0] items-center">
                  <div>
                    <p className="text-sm font-bold text-[#1A1D27]">08:30</p>
                    <p className="text-[10px] text-[#5E6470] mt-1">Boarding: 08:15</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#EF4444]">08:00</p>
                    <p className="text-[10px] font-bold text-[#94A3B8] uppercase mt-1">STRICT</p>
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <Ship className="w-4 h-4 text-[#1A1D27]" />
                    <div>
                      <p className="text-sm font-bold text-[#1A1D27]">Majestic 1</p>
                      <p className="text-[11px] text-[#94A3B8]">Majestic Fast Ferry</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1D27]">PSA Keppel</p>
                    <p className="text-[10px] font-bold text-[#94A3B8] uppercase mt-1">TERMINAL 2</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1D27]">09:45</p>
                  </div>
                  <div className="pr-4">
                    <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden mb-1.5">
                      <div className="h-full bg-[#10B981] w-[45%] rounded-full"></div>
                    </div>
                    <p className="text-[10px] font-medium text-[#5E6470] text-center">45% Full</p>
                  </div>
                  <div className="text-right flex justify-end">
                    <div className="bg-[#D1FAE5] border border-[#A7F3D0] rounded-md px-3 py-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                      <span className="text-[10px] font-bold text-[#065F46] uppercase">AVAILABLE</span>
                    </div>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-8 gap-4 px-6 py-5 border-b border-[#E2E8F0] items-center">
                  <div>
                    <p className="text-sm font-bold text-[#1A1D27]">09:15</p>
                    <p className="text-[10px] text-[#5E6470] mt-1">Boarding: 09:00</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#EF4444]">08:45</p>
                    <p className="text-[10px] font-bold text-[#94A3B8] uppercase mt-1">STRICT</p>
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <Ship className="w-4 h-4 text-[#1A1D27]" />
                    <div>
                      <p className="text-sm font-bold text-[#1A1D27]">Batam Fast 3</p>
                      <p className="text-[11px] text-[#94A3B8]">Batam Fast</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1D27]">Changi</p>
                    <p className="text-[10px] font-bold text-[#94A3B8] uppercase mt-1">FERRY TERMINAL</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1D27]">10:20</p>
                  </div>
                  <div className="pr-4">
                    <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden mb-1.5">
                      <div className="h-full bg-[#F59E0B] w-[85%] rounded-full"></div>
                    </div>
                    <p className="text-[10px] font-medium text-[#5E6470] text-center">85% Full</p>
                  </div>
                  <div className="text-right flex justify-end">
                    <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-md px-3 py-1 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                      <span className="text-[10px] font-bold text-[#92400E] uppercase">LIMITED</span>
                    </div>
                  </div>
                </div>

                {/* Row 3 */}
                <div className="grid grid-cols-8 gap-4 px-6 py-5 border-b border-[#E2E8F0] items-center">
                  <div>
                    <p className="text-sm font-bold text-[#1A1D27]">10:00</p>
                    <p className="text-[10px] text-[#EF4444] mt-1">Delayed</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#94A3B8]">09:30</p>
                    <p className="text-[10px] font-bold text-[#EF4444] uppercase mt-1">SUSPENDED</p>
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <Ship className="w-4 h-4 text-[#94A3B8]" />
                    <div>
                      <p className="text-sm font-bold text-[#1A1D27]">Sindo 5</p>
                      <p className="text-[11px] text-[#94A3B8]">Sindo Ferry</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1D27]">PSA Keppel</p>
                    <p className="text-[10px] font-bold text-[#94A3B8] uppercase mt-1">TERMINAL 2</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#94A3B8]">--:--</p>
                  </div>
                  <div className="pr-4">
                    <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden mb-1.5"></div>
                    <p className="text-[10px] font-medium text-[#94A3B8] text-center">Hold</p>
                  </div>
                  <div className="text-right flex justify-end">
                    <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-md px-3 py-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#DC2626]" />
                      <span className="text-[10px] font-bold text-[#991B1B] uppercase text-center leading-tight">WEATHER<br/>DELAY</span>
                    </div>
                  </div>
                </div>

                {/* Row 4 */}
                <div className="grid grid-cols-8 gap-4 px-6 py-5 border-b border-[#E2E8F0] items-center">
                  <div>
                    <p className="text-sm font-bold text-[#1A1D27]">11:30</p>
                    <p className="text-[10px] text-[#5E6470] mt-1">Boarding: 11:15</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#EF4444]">11:00</p>
                    <p className="text-[10px] font-bold text-[#94A3B8] uppercase mt-1">STRICT</p>
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <Ship className="w-4 h-4 text-[#1A1D27]" />
                    <div>
                      <p className="text-sm font-bold text-[#1A1D27]">Majestic 2</p>
                      <p className="text-[11px] text-[#94A3B8]">Majestic Fast Ferry</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1D27]">PSA Keppel</p>
                    <p className="text-[10px] font-bold text-[#94A3B8] uppercase mt-1">TERMINAL 1</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1D27]">12:45</p>
                  </div>
                  <div className="pr-4">
                    <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden mb-1.5">
                      <div className="h-full bg-[#10B981] w-[20%] rounded-full"></div>
                    </div>
                    <p className="text-[10px] font-medium text-[#5E6470] text-center">20% Full</p>
                  </div>
                  <div className="text-right flex justify-end">
                    <div className="bg-[#D1FAE5] border border-[#A7F3D0] rounded-md px-3 py-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                      <span className="text-[10px] font-bold text-[#065F46] uppercase">AVAILABLE</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Table Footer / Load More */}
            <div className="p-4 flex justify-center items-center">
              <Button variant="ghost" className="text-[#1A1D27] font-bold text-sm hover:bg-slate-50 transition-colors">
                Load More Schedules <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </div>

          </Card>
          
        </div>

      </div>
    </div>
  );
}
