"use client";

import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronRight, Calendar, Ship, AlertCircle, ChevronDown, CheckCircle2, AlertTriangle, Wind } from "lucide-react";

export default function FerrySchedulesPage() {
  return (
    <div className="flex flex-col relative bg-[#f8fafc] rounded-3xl overflow-hidden min-h-[calc(100vh-8rem)]">
      {/* Premium Background Mesh/Gradient */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[60%] rounded-full bg-indigo-400/10 blur-[120px]" />
        <div className="absolute -bottom-[10%] left-[20%] w-[60%] h-[40%] rounded-full bg-emerald-400/10 blur-[120px]" />
      </div>
      
      <div className="relative z-10 p-6 md:p-8 flex flex-col h-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-10">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-serif text-slate-900 mb-3 tracking-tight">Ferry Schedules</h1>
            <p className="text-slate-500 text-sm leading-relaxed max-w-lg">
              Real-time departure intelligence for cross-border logistics routes to Singapore. 
              Powered by <span className="font-semibold text-primary">SmartFlow AI</span>.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/60 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"></div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Live Sync Active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column (3/12) */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
            
            {/* Glass Terminal Selector Card */}
            <Card className="rounded-[32px] p-2 bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-1 overflow-hidden">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-5 py-3">Origin Port</p>
              
              <div className="bg-white/80 rounded-[24px] flex items-center justify-between p-4 shadow-sm border border-white cursor-pointer group relative overflow-hidden transition-all hover:shadow-md">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-l-[24px]"></div>
                <span className="font-bold text-slate-800 text-sm pl-2">Batam Center</span>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                  <ChevronRight className="w-4 h-4 text-blue-600 transform group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              
              <div className="rounded-[24px] flex items-center justify-between p-4 cursor-pointer hover:bg-white/50 transition-all text-slate-600 hover:text-slate-900 border border-transparent">
                <span className="font-medium text-sm pl-3">Sekupang</span>
              </div>
              
              <div className="rounded-[24px] flex items-center justify-between p-4 cursor-pointer hover:bg-white/50 transition-all text-slate-600 hover:text-slate-900 border border-transparent">
                <span className="font-medium text-sm pl-3">Batu Ampar</span>
              </div>
            </Card>

            {/* Premium Terminal Info Card */}
            <Card className="rounded-[32px] overflow-hidden bg-white/60 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col group">
              <div className="h-48 w-full relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10"></div>
                <img 
                  src="https://images.unsplash.com/photo-1559061036-7cbdfaee6d1d?q=80&w=800&auto=format&fit=crop" 
                  alt="Batam Center Port" 
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute bottom-4 left-6 z-20">
                  <h3 className="text-xl font-serif text-white mb-1 shadow-sm">Batam Center</h3>
                  <div className="flex items-center gap-1.5 text-white/80">
                    <MapPin className="w-3.5 h-3.5" />
                    <p className="text-xs font-medium tracking-wide">Premium Terminal</p>
                  </div>
                </div>
              </div>
              <div className="flex bg-white/50 backdrop-blur-md">
                <div className="flex-1 p-5 text-center border-r border-white/50">
                  <span className="text-2xl font-light text-blue-600 block mb-0.5">24</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Daily Trips</span>
                </div>
                <div className="flex-1 p-5 text-center">
                  <span className="text-2xl font-light text-emerald-600 block mb-0.5">85%</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">On-Time</span>
                </div>
              </div>
            </Card>
            
          </div>

          {/* Right Column (9/12) */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
            
            {/* Floating Filter Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/60 backdrop-blur-2xl rounded-full p-2 pl-8 border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center gap-8 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 hide-scrollbar">
                <div className="relative group cursor-pointer">
                  <span className="text-sm font-bold text-blue-600 whitespace-nowrap">All Destinations</span>
                  <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></div>
                </div>
                <span className="text-sm font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap cursor-pointer transition-colors">PSA Keppel</span>
                <span className="text-sm font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap cursor-pointer transition-colors">Changi</span>
              </div>
              <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-full w-full sm:w-auto justify-center shadow-sm border border-slate-100 hover:border-blue-200 transition-colors cursor-pointer group">
                <Calendar className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold text-slate-700">Oct 27, 2023</span>
                <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
              </div>
            </div>

            {/* Glass Schedule Table Card */}
            <Card className="rounded-[32px] overflow-hidden bg-white/60 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.05)] flex flex-col w-full overflow-x-auto">
              <div className="min-w-[850px]">
                
                {/* Table Header */}
                <div className="grid grid-cols-6 gap-4 px-8 py-5 bg-white/40 border-b border-white/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <div>Departure</div>
                  <div>Vessel / Operator</div>
                  <div>Destination</div>
                  <div>Est. Arrival</div>
                  <div>Capacity</div>
                  <div className="text-right">Status</div>
                </div>

                {/* Rows with beautiful hover states */}
                
                {/* Row 1: Available */}
                <div className="grid grid-cols-6 gap-4 px-8 py-6 border-b border-white/50 items-center hover:bg-white/80 transition-all duration-300 group cursor-default">
                  <div>
                    <p className="text-lg font-bold text-slate-900">08:30</p>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">Brdg: <span className="text-blue-600">08:15</span></p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                        <Ship className="w-3 h-3 text-blue-600" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">Majestic 1</p>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium pl-8">Majestic Fast Ferry</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">PSA Keppel</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Terminal 2</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">09:45</p>
                  </div>
                  <div className="pr-4">
                    <div className="flex justify-between items-end mb-1.5">
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">45% Full</p>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 w-[45%] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                    </div>
                  </div>
                  <div className="text-right flex justify-end">
                    <div className="bg-emerald-50 border border-emerald-200/60 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <span className="text-[10px] font-bold text-emerald-700 tracking-widest uppercase">Available</span>
                    </div>
                  </div>
                </div>

                {/* Row 2: Limited */}
                <div className="grid grid-cols-6 gap-4 px-8 py-6 border-b border-white/50 items-center hover:bg-white/80 transition-all duration-300 group cursor-default">
                  <div>
                    <p className="text-lg font-bold text-slate-900">09:15</p>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">Brdg: <span className="text-blue-600">09:00</span></p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                        <Ship className="w-3 h-3 text-blue-600" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">Batam Fast 3</p>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium pl-8">Batam Fast</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Changi</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ferry Terminal</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">10:20</p>
                  </div>
                  <div className="pr-4">
                    <div className="flex justify-between items-end mb-1.5">
                      <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">85% Full</p>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 w-[85%] rounded-full shadow-[0_0_10px_rgba(249,115,22,0.3)]"></div>
                    </div>
                  </div>
                  <div className="text-right flex justify-end">
                    <div className="bg-orange-50 border border-orange-200/60 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                      <AlertTriangle className="w-3 h-3 text-orange-500" />
                      <span className="text-[10px] font-bold text-orange-700 tracking-widest uppercase">Limited</span>
                    </div>
                  </div>
                </div>

                {/* Row 3: Weather Delay (Glassy red) */}
                <div className="grid grid-cols-6 gap-4 px-8 py-6 border-b border-white/50 items-center bg-red-50/40 hover:bg-red-50/60 transition-all duration-300 group cursor-default relative overflow-hidden">
                  {/* Subtle red gradient glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent pointer-events-none"></div>
                  
                  <div className="relative z-10">
                    <p className="text-lg font-bold text-red-500 line-through decoration-red-300">10:00</p>
                    <p className="text-[10px] text-red-600 mt-1 uppercase tracking-wider font-bold animate-pulse">Delayed</p>
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1 opacity-70">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                        <Ship className="w-3 h-3 text-slate-500" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">Sindo 5</p>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium pl-8">Sindo Ferry</p>
                  </div>
                  <div className="relative z-10">
                    <p className="text-sm font-bold text-slate-600">PSA Keppel</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Terminal 2</p>
                  </div>
                  <div className="relative z-10">
                    <p className="text-sm font-medium text-slate-400">--:--</p>
                  </div>
                  <div className="pr-4 relative z-10 opacity-50">
                    <div className="flex justify-between items-end mb-1.5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hold</p>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner"></div>
                  </div>
                  <div className="text-right flex justify-end relative z-10">
                    <div className="bg-red-50 border border-red-200 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                      <Wind className="w-3 h-3 text-red-500" />
                      <span className="text-[10px] font-bold text-red-700 tracking-widest uppercase">Weather Delay</span>
                    </div>
                  </div>
                </div>

                {/* Table Footer */}
                <div className="p-6 flex justify-center items-center bg-white/20">
                  <Button variant="ghost" className="text-blue-600 font-bold text-xs uppercase tracking-widest hover:bg-white hover:text-blue-700 rounded-full px-6 py-5 shadow-sm border border-transparent hover:border-blue-100 transition-all group">
                    Load More Schedules
                    <ChevronDown className="w-4 h-4 ml-2 group-hover:translate-y-0.5 transition-transform" />
                  </Button>
                </div>

              </div>
            </Card>
            
          </div>
        </div>
      </div>
    </div>
  );
}
