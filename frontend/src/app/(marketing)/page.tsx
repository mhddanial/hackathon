"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlayCircle, ShieldCheck, Activity, BarChart3, Map as MapIcon, Leaf, Bot, AlertTriangle, CheckCircle2, MoreHorizontal, Ship } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 lg:px-12 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center bg-blue-50/50">
            <span className="text-blue-600 font-serif font-bold text-lg leading-none">C</span>
          </div>
          <span className="font-bold text-slate-800 text-lg tracking-tight">SmartFlow</span>
        </div>
        
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <Link href="/dashboard" className="hover:text-blue-600 transition-colors">Dashboard</Link>
          <Link href="/planner" className="hover:text-blue-600 transition-colors">Route Planner</Link>
          <Link href="/schedules" className="hover:text-blue-600 transition-colors">Ferry Schedules</Link>
          <Link href="/oracle" className="hover:text-blue-600 transition-colors">Logistics Oracle</Link>
        </nav>
        
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 hidden sm:block">
            Sign In
          </Link>
          <Link href="/login">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold px-6 shadow-md shadow-blue-600/20">
              GET STARTED
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 lg:pt-32 lg:pb-36 px-6 lg:px-12 overflow-hidden flex flex-col items-center">
        {/* Faint Background Pattern */}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-40" 
             style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%2394a3b8\' fill-opacity=\'0.2\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
        </div>

        <div className="relative z-10 w-full max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left: Copy */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                NEXT-GEN CROSS-BORDER LOGISTICS
              </span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-[70px] font-serif text-slate-900 leading-[1.05] mb-6 tracking-tight">
              Optimize Batam-Singapore Logistics with <span className="text-blue-600">AI Precision.</span>
            </h1>
            
            <p className="text-base text-slate-500 leading-relaxed mb-10 max-w-lg">
              SmartFlow empowers your supply chain with intelligent route planning, real-time port analytics, and sustainability metrics to eliminate delays and reduce emissions.
            </p>
            
            <div className="flex flex-wrap items-center gap-4 mb-16">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-8 py-6 font-bold shadow-lg shadow-blue-600/20 text-xs tracking-wider uppercase">
                Get Started
              </Button>
              <Button variant="outline" className="rounded-md px-6 py-6 font-bold text-slate-600 bg-white border-slate-200 hover:bg-slate-50 text-xs tracking-wider uppercase">
                <PlayCircle className="w-4 h-4 mr-2 text-slate-400" />
                Watch Demo
              </Button>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-12">
              <div>
                <p className="text-3xl font-bold text-slate-900 mb-1 tracking-tight">99.8%</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Uptime</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 mb-1 tracking-tight">-30%</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Emissions</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 mb-1 tracking-tight">0</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Missed Cut-offs</p>
              </div>
            </div>
          </div>

          {/* Right: Visual */}
          <div className="relative h-[500px] flex items-center justify-center lg:justify-end">
            <Card className="w-full max-w-md aspect-square rounded-[32px] bg-white shadow-[0_20px_80px_rgb(0,0,0,0.06)] border border-slate-100 flex items-center justify-center relative z-10">
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 mb-4 relative flex items-center justify-center">
                  <div className="absolute inset-0 border-[6px] border-blue-600 rounded-full border-t-transparent animate-spin-slow"></div>
                  <div className="absolute inset-2 border-[6px] border-blue-100 rounded-full border-b-transparent"></div>
                  <Activity className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-4xl font-bold tracking-tighter text-blue-600">CROSSFLOW</h3>
              </div>
            </Card>

            <Card className="absolute -bottom-6 left-0 lg:-left-12 z-20 w-64 rounded-xl p-4 bg-white shadow-2xl shadow-black/5 border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                  <Ship className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Ferry Status</p>
                  <p className="text-sm font-bold text-slate-800">On Schedule - 14:30</p>
                </div>
              </div>
            </Card>
          </div>
          
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-slate-50 py-24 px-6 lg:px-12 border-t border-slate-100 flex flex-col items-center">
        <div className="max-w-[1200px] w-full">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-4xl font-serif text-slate-900 mb-4">Engineered for Efficiency</h2>
            <p className="text-slate-500">
              Our platform tackles the unique challenges of the Singapore Strait, transforming fragmented data into actionable logistical intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1 */}
            <Card className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Route Optimization</h3>
              <p className="text-xs leading-relaxed text-slate-500 mb-8 flex-1">
                Dynamically calculate the most efficient truck-to-ferry paths, factoring in real-time traffic across Batam and Tuas checkpoint delays.
              </p>
              <div className="w-full h-24 bg-blue-50/50 rounded-lg flex items-end justify-between p-3 gap-2 border border-blue-50 overflow-hidden">
                 <div className="w-full bg-blue-200 rounded-t-sm h-[30%]"></div>
                 <div className="w-full bg-blue-400 rounded-t-sm h-[50%]"></div>
                 <div className="w-full bg-blue-500 rounded-t-sm h-[70%]"></div>
                 <div className="w-full bg-blue-600 rounded-t-sm h-[90%] shadow-sm"></div>
              </div>
            </Card>

            {/* Card 2 */}
            <Card className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-6">
                <MapIcon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Real-Time Heatmaps</h3>
              <p className="text-xs leading-relaxed text-slate-500 mb-8 flex-1">
                Visualize port congestion at Batu Ampar and HarbourFront before your cargo arrives. Proactively reroute to minimize idle time.
              </p>
              <div className="w-full h-24 bg-teal-50 rounded-lg border border-teal-100 overflow-hidden relative">
                 <div className="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=600&auto=format&fit=crop')] bg-cover bg-center"></div>
                 <div className="absolute inset-0 bg-gradient-to-tr from-cyan-400/20 to-teal-400/20 mix-blend-overlay"></div>
              </div>
            </Card>

            {/* Card 3 */}
            <Card className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-6">
                <Leaf className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Sustainability Analytics</h3>
              <p className="text-xs leading-relaxed text-slate-500 mb-8 flex-1">
                Track and report Scope 3 emissions automatically. Make data-driven decisions to choose lower-emission transport configurations.
              </p>
              <div className="w-full h-24 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-center">
                 <div className="relative w-16 h-16">
                   <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                     <circle cx="50" cy="50" r="40" className="stroke-slate-200" strokeWidth="12" fill="transparent" />
                     <circle cx="50" cy="50" r="40" className="stroke-blue-600" strokeWidth="12" fill="transparent" strokeDasharray="251" strokeDashoffset="60" strokeLinecap="round" />
                   </svg>
                   <div className="absolute inset-0 flex items-center justify-center">
                     <span className="text-[10px] font-bold text-slate-700">75%<br/><span className="text-[6px] text-slate-400 font-normal">TARGET</span></span>
                   </div>
                 </div>
              </div>
            </Card>
            
          </div>
        </div>
      </section>

      {/* Dark Oracle Section */}
      <section className="bg-slate-950 py-24 px-6 lg:px-12 relative overflow-hidden flex flex-col items-center">
        {/* Subtle tech background */}
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center mix-blend-luminosity"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-blue-950/40"></div>

        <div className="relative z-10 w-full max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left: Copy */}
          <div className="flex flex-col">
            <div className="inline-flex items-center gap-2 bg-slate-900/50 border border-slate-800 rounded-full px-4 py-1.5 w-fit mb-8 backdrop-blur-sm">
              <Bot className="w-4 h-4 text-blue-400" />
              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Meet the Logistics Oracle</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-serif text-white leading-tight mb-6">
              Your Autonomous Supply Chain Agent
            </h2>
            
            <p className="text-base text-slate-400 leading-relaxed mb-8 max-w-md">
              Stop manually checking schedules. The Oracle monitors maritime traffic, port conditions, and trucking telematics 24/7 to autonomously suggest the optimal shipment configurations.
            </p>
            
            <div className="flex flex-col gap-5 mb-10">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Predictive Delay Alerts</h4>
                  <p className="text-xs text-slate-400">Get notified hours before a potential missed cut-off at HarbourFront.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Automated Re-routing</h4>
                  <p className="text-xs text-slate-400">Instant alternative route generation when primary paths congest.</p>
                </div>
              </div>
            </div>
            
            <Button className="bg-blue-600 hover:bg-blue-500 text-white w-fit px-8 py-6 rounded-md font-bold text-xs tracking-wider uppercase">
              Explore AI Features
            </Button>
          </div>

          {/* Right: Mock UI */}
          <div className="relative w-full">
            <div className="w-full bg-[#0B1221] rounded-2xl border border-slate-800 shadow-2xl shadow-blue-900/20 overflow-hidden flex flex-col relative z-10 backdrop-blur-md transform rotate-1 md:rotate-2">
              
              {/* Mock Header */}
              <div className="p-4 border-b border-slate-800/50 flex items-center justify-between bg-[#0F172A]/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-200 leading-none mb-1">Logistics Oracle</p>
                    <p className="text-[9px] text-emerald-400 flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block"></span> Active
                    </p>
                  </div>
                </div>
                <MoreHorizontal className="w-5 h-5 text-slate-600" />
              </div>
              
              {/* Mock Body */}
              <div className="p-6 flex flex-col gap-4 bg-[#0B1221]">
                
                <div className="bg-slate-800/50 rounded-xl rounded-tl-sm p-4 text-xs text-slate-300 border border-slate-700/50 max-w-[85%] leading-relaxed">
                  Analyzing route: Batam Center → Tanah Merah. Departure scheduled for 14:00.
                </div>
                
                <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 self-end w-full max-w-[90%]">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Alert Detected</span>
                  </div>
                  <p className="text-xs text-red-200 leading-relaxed">
                    High congestion detected at Tanah Merah ferry terminal. Estimated delay: 45 mins. High risk of missing onward truck connection.
                  </p>
                </div>

                <div className="bg-blue-950/30 border border-blue-900/50 rounded-xl p-4 w-full">
                  <div className="flex items-center gap-2 mb-3">
                    <MapIcon className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Action Proposed</span>
                  </div>
                  <p className="text-xs text-blue-200 leading-relaxed mb-4">
                    Re-routing via Sekupang → HarbourFront is currently optimal. Saves 30 mins and ensures truck connection.
                  </p>
                  <button className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded p-2.5 text-xs font-bold transition-colors shadow-lg shadow-blue-900/20">
                    APPROVE RE-ROUTE
                  </button>
                </div>

              </div>
            </div>
            
            {/* Glow effects */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-600/10 blur-[100px] pointer-events-none z-0"></div>
          </div>
          
        </div>
      </section>

    </div>
  );
}
