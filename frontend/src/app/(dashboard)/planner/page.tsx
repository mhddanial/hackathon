"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Plus, MapPin, Search, ChevronDown, Clock, Leaf, Target, Layers } from "lucide-react";
import Link from "next/link";

export default function RouteRecommendationPage() {
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
                <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5 block">FIRST LOCATION</label>
                <div className="flex items-center justify-between border border-[#E2E8F0] rounded-lg px-4 py-2.5 bg-white">
                  <span className="text-sm font-medium text-[#1A1D27]">Suzhou Industrial Park, CN</span>
                  <Target className="w-4 h-4 text-[#94A3B8]" />
                </div>
              </div>
              
              {/* Destination */}
              <div className="relative">
                <div className="absolute -left-[35px] top-[22px] w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[#64748B]">
                  <MapPin className="w-4 h-4" />
                </div>
                <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5 block">DESTINATION</label>
                <div className="flex items-center justify-between border border-[#E2E8F0] rounded-lg px-4 py-2.5 bg-white">
                  <span className="text-sm font-medium text-[#1A1D27]">Port of Long Beach, US</span>
                  <Search className="w-4 h-4 text-[#94A3B8]" />
                </div>
              </div>
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5 block">CARGO TYPE</label>
                <div className="flex items-center justify-between border border-[#E2E8F0] rounded-lg px-3 py-2.5 bg-white">
                  <span className="text-sm font-medium text-[#1A1D27]">Electronics (TEU)</span>
                  <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1.5 block">PRIORITY</label>
                <div className="flex items-center justify-between border border-[#E2E8F0] rounded-lg px-3 py-2.5 bg-white">
                  <span className="text-sm font-medium text-[#1A1D27]">Balanced</span>
                  <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                </div>
              </div>
            </div>
          </Card>

          {/* Mini Cards Row */}
          <div className="grid grid-cols-2 gap-6">
            
            {/* Departure Window */}
            <Card className="rounded-[16px] p-6 shadow-sm border-[#E2E8F0] bg-white flex flex-col justify-between h-full">
              <div>
                <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#1A1D27] mb-4">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-[#1A1D27] leading-tight mb-2">Departure<br/>Window</h3>
                <p className="text-xs text-[#5E6470]">Optimal window based on port congestion.</p>
              </div>
              <div className="mt-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-[32px] font-bold text-[#1A1D27] leading-none">14:00</span>
                  <span className="text-sm font-bold text-[#10B981]">Today</span>
                </div>
                <div className="flex items-center border-l-2 border-[#10B981] pl-2 mt-2">
                  <span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">SAVES 4HRS IDLE TIME</span>
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
                  LEAFY_GREEN OPTIMAL
                </div>
              </div>
              
              <div>
                <h3 className="text-[20px] font-semibold text-white mb-1">Impact</h3>
                <p className="text-xs text-[#93C5FD]">CO2e reduction vs<br/>standard route.</p>
              </div>
              
              <div className="mt-6 flex justify-between items-end">
                <div>
                  <span className="text-[36px] font-bold text-white leading-none block mb-1">-18%</span>
                  <span className="text-[9px] font-bold text-white uppercase tracking-widest">3.2 TONS<br/>SAVED</span>
                </div>
                <div className="w-10 h-6">
                   <svg viewBox="0 0 100 50" className="w-full h-full preserve-aspect-ratio-none overflow-visible">
                     <path d="M0,40 L30,45 L60,20 L80,30 L100,10" className="stroke-white" strokeWidth="4" fill="transparent" strokeLinecap="round" strokeLinejoin="round" />
                     <circle cx="100" cy="10" r="4" className="fill-white" />
                   </svg>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Main Map Area */}
          <div className="flex-1 rounded-[16px] overflow-hidden relative shadow-sm border-[#E2E8F0] min-h-[400px] bg-white">
            
            {/* Map Image matching mockup */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center opacity-30 grayscale hidden"></div>
            {/* Real mockup map replacement */}
            <div className="absolute inset-0 bg-[#E5E7EB] bg-[url('https://upload.wikimedia.org/wikipedia/commons/4/4b/San_Francisco_streets_map.png')] bg-cover bg-center mix-blend-multiply opacity-60"></div>

            {/* Map Top Controls Overlay */}
            <div className="absolute top-4 left-4 flex gap-2 z-10">
              <div className="flex bg-white rounded-full shadow-sm border border-[#E2E8F0] p-1">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white font-semibold text-xs text-[#1A1D27] shadow-sm border border-[#E2E8F0]">
                  <span className="w-2 h-2 rounded-full bg-[#2563EB]"></span> Recommended
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full font-semibold text-xs text-[#5E6470]">
                  <span className="w-2 h-2 rounded-full bg-[#94A3B8]"></span> Standard
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full font-semibold text-xs text-[#5E6470] border-l border-[#E2E8F0] rounded-l-none">
                  <Layers className="w-3.5 h-3.5" /> Traffic Layer
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-white rounded-full shadow-sm border border-[#E2E8F0] px-4 py-1.5">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">CONGESTION:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                  <span className="text-[10px] font-bold text-[#5E6470] uppercase tracking-wider">LOW</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                  <span className="text-[10px] font-bold text-[#5E6470] uppercase tracking-wider">HIGH</span>
                </div>
              </div>
            </div>

            {/* Tooltip on Map */}
            <div className="absolute top-[35%] left-[50%] flex flex-col items-center z-10">
              <div className="bg-[#1A1D27] text-white text-[10px] font-semibold px-3 py-2 rounded-md shadow-md relative">
                760 Market Street, San Francisco, CA 94107
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1A1D27] transform rotate-45"></div>
              </div>
              <div className="mt-2 text-[#2563EB] drop-shadow-md">
                <MapPin className="w-8 h-8 fill-[#2563EB] text-white" />
              </div>
            </div>

          </div>

          {/* Bottom Summary Bar */}
          <Card className="rounded-[16px] p-6 shadow-sm border-[#E2E8F0] bg-white flex justify-between items-center">
            
            <div className="flex gap-12">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">TOTAL EST. TIME</span>
                <span className="text-2xl font-bold text-[#1A1D27]">14d 6h</span>
              </div>
              
              <div className="w-px h-10 bg-[#E2E8F0]"></div>
              
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">TOTAL COST</span>
                <span className="text-2xl font-bold text-[#1A1D27]">$12,450</span>
              </div>
              
              <div className="w-px h-10 bg-[#E2E8F0]"></div>
              
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">RELIABILITY SCORE</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-[#10B981]">98%</span>
                  {/* Small trend up icon */}
                  <svg width="20" height="12" viewBox="0 0 20 12" className="stroke-[#10B981] overflow-visible">
                    <path d="M0,10 L6,4 L10,8 L18,0 M14,0 L18,0 L18,4" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
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
