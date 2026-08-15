"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Route, MapPin, Search, ChevronDown, Clock, Leaf, Factory, Ship, Layers } from "lucide-react";

export default function RoutePlannerPage() {
  return (
    <div className="flex flex-col bg-[#FAFAFA] rounded-3xl p-6 md:p-8 overflow-hidden min-h-[calc(100vh-8rem)]">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-serif text-foreground mb-2">Route Intelligence</h1>
          <p className="text-muted-foreground text-sm">Optimize your logistics path for speed, cost, and reduced emission impact.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="rounded-md px-4 py-2 font-medium text-foreground bg-muted/30 border-none hover:bg-muted/50">
            <History className="w-4 h-4 mr-2 text-muted-foreground" />
            Recent Routes
          </Button>
          <Button className="rounded-md px-6 font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
            <Route className="w-4 h-4 mr-2" />
            Calculate New
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-8">
        
        {/* Left Column (Parameters & Mini Cards) - 4/12 */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-6">
          
          {/* Parameters Card */}
          <Card className="rounded-[24px] p-6 shadow-sm border border-border bg-white flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-foreground">Parameters</h2>
              <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted font-bold text-[10px] uppercase tracking-wider px-3 py-1 border-none rounded-md">Live Data</Badge>
            </div>
            
            <div className="relative pl-8 mb-6">
              {/* Custom timeline line */}
              <div className="absolute left-[15px] top-6 bottom-6 w-0.5 bg-muted"></div>
              
              {/* Origin */}
              <div className="mb-6 relative">
                <div className="absolute -left-[35px] top-4 w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground border border-border/50">
                  <Factory className="w-4 h-4" />
                </div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Origin</label>
                <div className="flex items-center justify-between border border-border rounded-lg px-4 py-3 bg-white">
                  <span className="text-sm font-medium text-foreground">Suzhou Industrial Park, CN</span>
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              
              {/* Destination */}
              <div className="relative">
                <div className="absolute -left-[35px] top-4 w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground border border-border/50">
                  <Ship className="w-4 h-4" />
                </div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Destination</label>
                <div className="flex items-center justify-between border border-border rounded-lg px-4 py-3 bg-white">
                  <span className="text-sm font-medium text-foreground">Port of Long Beach, US</span>
                  <Search className="w-4 h-4 text-muted-foreground opacity-50" />
                </div>
              </div>
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Cargo Type</label>
                <div className="flex items-center justify-between border border-border rounded-lg px-3 py-2.5 bg-white cursor-pointer hover:border-muted-foreground/30 transition-colors">
                  <span className="text-sm font-medium text-foreground">Electronics (TEU)</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Priority</label>
                <div className="flex items-center justify-between border border-border rounded-lg px-3 py-2.5 bg-white cursor-pointer hover:border-muted-foreground/30 transition-colors">
                  <span className="text-sm font-medium text-foreground">Balanced</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </Card>

          {/* Mini Cards Row */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Departure Window */}
            <Card className="rounded-[24px] p-5 shadow-sm border border-border bg-white flex flex-col justify-between h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-muted/20 rounded-bl-full pointer-events-none"></div>
              <div>
                <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center text-foreground mb-4">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2 leading-tight">Departure<br/>Window</h3>
                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">Optimal window based on port congestion.</p>
              </div>
              <div className="mt-4">
                <div className="flex flex-col 2xl:flex-row 2xl:items-baseline gap-1 mb-3">
                  <span className="text-3xl font-bold text-foreground tracking-tight">14:00</span>
                  <span className="text-xs font-bold text-success">Today</span>
                </div>
                <div className="flex items-center border-l-2 border-success pl-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">Saves 4hrs<br/>idle time</span>
                </div>
              </div>
            </Card>

            {/* Impact Card (Dark) */}
            <Card className="rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-none bg-slate-900 flex flex-col justify-between h-full relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950"></div>
              
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex flex-col gap-3 mb-4">
                  {/* Badge moved above icon, wrapped safely */}
                  <div className="flex flex-wrap">
                    <Badge className="bg-success text-white hover:bg-success border-none font-bold text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-full">
                      Leafy_Green Optimal
                    </Badge>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/10 backdrop-blur-sm">
                    <Leaf className="w-5 h-5" />
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-white mb-2 leading-tight">Impact</h3>
                <p className="text-[11px] text-blue-200/70 font-medium leading-relaxed flex-1">CO2e reduction vs standard route.</p>
                
                <div className="mt-2 flex flex-col justify-end">
                  <div className="mb-2">
                    <span className="text-3xl font-bold text-white tracking-tight block">-18%</span>
                    <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest leading-tight mt-1 block">3.2 Tons<br/>Saved</span>
                  </div>
                  
                  {/* Tiny white sparkline pushed to bottom right */}
                  <div className="w-10 h-6 self-end relative">
                     <svg viewBox="0 0 100 50" className="w-full h-full preserve-aspect-ratio-none overflow-visible">
                       <path d="M0,40 L30,45 L60,20 L80,30 L100,10" className="stroke-white" strokeWidth="6" fill="transparent" strokeLinecap="round" strokeLinejoin="round" />
                       <circle cx="100" cy="10" r="4" className="fill-white" />
                     </svg>
                  </div>
                </div>
              </div>
            </Card>

          </div>
        </div>

        {/* Right Column (Map & Summary) - 8/12 */}
        <div className="lg:col-span-8 xl:col-span-8 flex flex-col gap-6">
          
          {/* Main Map Area */}
          <div className="flex-1 rounded-[24px] overflow-hidden relative shadow-sm border border-border min-h-[450px] bg-white">
            
            {/* Map Background (Shanghai area) */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-luminosity"></div>
            
            {/* Overlay to tint map similar to mockup */}
            <div className="absolute inset-0 bg-blue-50/60 mix-blend-multiply"></div>
            
            {/* Map Top Controls Overlay */}
            <div className="absolute top-4 left-4 right-4 flex flex-wrap justify-between gap-4 z-20">
              <div className="flex bg-white/90 backdrop-blur-md rounded-full shadow-md border border-border/50 p-1">
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white font-bold text-xs text-foreground shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary"></span> Recommended
                </div>
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground"></span> Standard
                </div>
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors border-l border-border rounded-l-none ml-1 pl-5">
                  <Layers className="w-3.5 h-3.5" /> Traffic Layer
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md rounded-full shadow-md border border-border/50 px-4 py-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Congestion:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-success"></span>
                  <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Low</span>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="w-2 h-2 rounded-full bg-critical"></span>
                  <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">High</span>
                </div>
              </div>
            </div>

            {/* Dashed Route Line Overlay (SVG) */}
            <svg viewBox="0 0 800 500" className="absolute inset-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none">
              <path 
                d="M 150 220 Q 250 300 400 250 T 650 150 L 800 250" 
                className="stroke-primary" 
                strokeWidth="4" 
                fill="none" 
                strokeDasharray="8,8"
                strokeLinecap="round"
              />
              <circle cx="150" cy="220" r="6" className="fill-primary stroke-white stroke-2" />
              <circle cx="480" cy="215" r="5" className="fill-white stroke-primary stroke-[3px]" />
            </svg>

            {/* Waypoint Tooltip */}
            <div className="absolute top-[38%] left-[65%] transform -translate-x-1/2 -translate-y-full bg-white rounded-xl p-4 shadow-xl border border-border z-20 min-w-[200px]">
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Waypoint Alpha</p>
               <p className="text-sm font-bold text-foreground">Avoid Weather System</p>
               {/* Arrow pointer */}
               <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-border transform rotate-45"></div>
            </div>

          </div>

          {/* Bottom Summary Bar */}
          <Card className="rounded-[24px] p-6 shadow-sm border border-border bg-white flex flex-col md:flex-row justify-between items-center gap-6">
            
            <div className="flex gap-8 md:gap-12 w-full md:w-auto overflow-x-auto">
              <div className="flex flex-col gap-1 min-w-max">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Est. Time</span>
                <span className="text-2xl font-bold text-foreground">14d 6h</span>
              </div>
              
              <div className="w-px h-10 bg-border hidden md:block"></div>
              
              <div className="flex flex-col gap-1 min-w-max">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Cost</span>
                <span className="text-2xl font-bold text-foreground">$12,450</span>
              </div>
              
              <div className="w-px h-10 bg-border hidden md:block"></div>
              
              <div className="flex flex-col gap-1 min-w-max">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Reliability Score</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-success">98%</span>
                  {/* Small sparkline */}
                  <svg width="24" height="12" viewBox="0 0 24 12" className="stroke-success overflow-visible">
                    <path d="M0,8 L6,10 L12,4 L18,6 L24,0" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>

            <Button className="w-full md:w-auto rounded-lg px-8 py-6 font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
              Confirm Route
            </Button>

          </Card>

        </div>

      </div>
    </div>
  );
}
