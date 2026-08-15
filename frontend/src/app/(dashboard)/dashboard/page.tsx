"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, RefreshCw, Anchor, Leaf, AlertTriangle, Ship, Map, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="flex flex-col bg-[#FAFAFA] rounded-3xl p-6 md:p-8 overflow-hidden min-h-[calc(100vh-8rem)]">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif text-foreground mb-2">Logistics Overview</h1>
          <p className="text-muted-foreground text-sm">Real-time network performance and sustainability impact</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="rounded-md px-4 py-2 font-medium text-foreground bg-muted/30 border-none hover:bg-muted/50">
            <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
            Today
          </Button>
          <Button className="rounded-md px-6 font-medium bg-primary text-primary-foreground hover:bg-primary/90">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Top 3 Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Primary Corridors */}
        <Card className="rounded-[24px] p-6 shadow-sm border border-border bg-white flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Map className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-medium text-foreground">Primary Corridors</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Yos Sudarso</span>
              <Badge variant="secondary" className="bg-critical/10 text-critical hover:bg-critical/10 border-none font-bold text-[10px] uppercase tracking-wider px-3 py-1">High Congestion</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Sudirman</span>
              <Badge variant="secondary" className="bg-success/10 text-success hover:bg-success/10 border-none font-bold text-[10px] uppercase tracking-wider px-3 py-1">Smooth Flow</Badge>
            </div>
          </div>
        </Card>

        {/* Next Ferry Departures */}
        <Card className="rounded-[24px] p-6 shadow-sm border border-border bg-white flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Ship className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-medium text-foreground">Next Ferry Departures</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Batam Center → SGP</span>
              <span className="text-sm font-medium text-foreground">14:30</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Batu Ampar → JKT</span>
              <span className="text-sm font-medium text-foreground">15:15</span>
            </div>
          </div>
        </Card>

        {/* Total Emission Saved */}
        <Card className="rounded-[24px] p-6 shadow-sm border border-border bg-white flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center">
              <Leaf className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-medium text-foreground">Total Emission Saved</h3>
          </div>
          <div>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-5xl font-light text-success">42.8</span>
              <span className="text-lg font-bold text-success mb-1">tCO₂e</span>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">+12% VS LAST MONTH</p>
          </div>
        </Card>

      </div>

      {/* Middle Section: Heatmap (Left, 2/3) + Metrics (Right, 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Left: Corridor Heatmap */}
        <Card className="lg:col-span-2 rounded-[32px] p-6 md:p-8 flex flex-col shadow-sm border border-border bg-white relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:justify-between items-start gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-serif text-foreground">Corridor Heatmap</h2>
              <p className="text-sm text-muted-foreground mt-1">Live traffic density: Yos Sudarso & Sudirman</p>
            </div>
            <div className="flex flex-wrap gap-2 md:gap-3">
              <Badge variant="outline" className="rounded-full px-4 py-1.5 font-medium border-border bg-muted/20 text-foreground text-xs">
                <span className="w-2 h-2 rounded-full bg-success mr-2"></span> Flowing
              </Badge>
              <Badge variant="outline" className="rounded-full px-4 py-1.5 font-medium border-border bg-muted/20 text-foreground text-xs">
                <span className="w-2 h-2 rounded-full bg-warning mr-2"></span> Heavy
              </Badge>
              <Badge variant="outline" className="rounded-full px-4 py-1.5 font-medium border-border bg-muted/20 text-foreground text-xs">
                <span className="w-2 h-2 rounded-full bg-critical mr-2"></span> Jammed
              </Badge>
            </div>
          </div>
          
          {/* Map Container */}
          <div className="flex-1 rounded-[24px] overflow-hidden relative min-h-[400px]">
             {/* Map Background */}
             <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center opacity-70"></div>
             
             {/* Overlay to simulate map style from mockup */}
             <div className="absolute inset-0 bg-blue-50/40 mix-blend-multiply"></div>
             
             {/* Heatmap blur spots to simulate the mockup's visual */}
             <div className="absolute top-[35%] left-[25%] w-[35%] h-[15%] bg-warning/50 blur-[30px] rounded-full"></div>
             <div className="absolute top-[25%] left-[55%] w-[25%] h-[15%] bg-critical/60 blur-[30px] rounded-full rotate-[-20deg]"></div>
             
             {/* Accident Tooltip Overlay */}
             <div className="absolute top-[50%] left-[30%] bg-white rounded-[16px] p-5 shadow-lg border border-border max-w-[240px] z-10 flex flex-col items-center text-center">
                <p className="text-[10px] font-bold text-critical uppercase tracking-wider mb-2">Accident Reported</p>
                <p className="text-sm text-foreground">Sudirman intersection, expect +25m delay.</p>
                
                {/* Tooltip triangle */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[12px] border-b-white filter drop-shadow-md"></div>
             </div>
          </div>
        </Card>

        {/* Right: Metrics */}
        <div className="flex flex-col gap-6">
          
          {/* Batu Ampar Port Card */}
          <Card className="rounded-[32px] p-8 shadow-sm border border-border bg-white flex flex-col justify-between flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Anchor className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-serif text-foreground">Batu Ampar Port</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Current Terminal Status</p>
              </div>
            </div>
            
            <div className="my-6">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-6xl font-light text-foreground">82%</span>
                <span className="text-sm font-medium text-critical">~+5%</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pr-4">
                Capacity reached. Expect berthing delays of up to 4 hours for non-priority vessels.
              </p>
            </div>
            
            <div>
              <div className="flex justify-between text-xs font-bold mb-3">
                <span className="text-foreground">Berth Availability</span>
                <span className="text-foreground">2 / 12 Open</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-critical w-[82%] rounded-full"></div>
              </div>
            </div>
          </Card>

          {/* Carbon Savings Card */}
          <Card className="rounded-[32px] p-8 shadow-sm border border-border bg-white flex flex-col justify-between flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-success/10 text-success flex items-center justify-center">
                <Leaf className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-serif text-foreground">Carbon Savings</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Daily routing optimization</p>
              </div>
            </div>
            
            <div className="my-4">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-5xl font-light text-success">1.4</span>
                <span className="text-lg font-bold text-success mb-1">tCO₂e</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Prevented today by bypassing Yos Sudarso congestion.
              </p>
            </div>
            
            {/* Custom Bar Chart matching mockup */}
            <div className="flex items-end justify-between h-20 mt-2 gap-3 px-1">
              <div className="flex flex-col items-center flex-1 gap-2">
                <div className="w-full bg-muted/40 rounded-t-sm h-[30%]"></div>
                <span className="text-[9px] font-bold text-foreground">Mon</span>
              </div>
              <div className="flex flex-col items-center flex-1 gap-2">
                <div className="w-full bg-muted/40 rounded-t-sm h-[40%]"></div>
                <span className="text-[9px] font-bold text-foreground">Tue</span>
              </div>
              <div className="flex flex-col items-center flex-1 gap-2">
                <div className="w-full bg-muted/40 rounded-t-sm h-[25%]"></div>
                <span className="text-[9px] font-bold text-foreground">Wed</span>
              </div>
              <div className="flex flex-col items-center flex-1 gap-2">
                <div className="w-full bg-muted/40 rounded-t-sm h-[60%]"></div>
                <span className="text-[9px] font-bold text-foreground">Thu</span>
              </div>
              <div className="flex flex-col items-center flex-1 gap-2 relative">
                <span className="absolute -top-5 text-[9px] font-bold text-success">1.4</span>
                <div className="w-full bg-success rounded-t-sm h-[90%]"></div>
                <span className="text-[9px] font-bold text-success">Today</span>
              </div>
            </div>
          </Card>
          
        </div>
      </div>

      {/* Bottom Section: Recent Activity History */}
      <div>
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-serif text-foreground mb-1">Recent Activity History</h2>
            <p className="text-sm text-muted-foreground">Logistics optimization and routing logs</p>
          </div>
          <Button variant="link" className="text-[10px] font-bold text-primary uppercase tracking-widest p-0">
            EXPORT CSV
          </Button>
        </div>
        
        <Card className="rounded-[24px] overflow-hidden shadow-sm border border-border bg-white w-full overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-4 p-6 bg-muted/10 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <div>Timestamp</div>
              <div>Origin/Destination</div>
              <div>Recommended Departure</div>
              <div>Emission Saved</div>
            </div>

            {/* Row 1 */}
            <div className="grid grid-cols-4 gap-4 p-6 border-b border-border items-center">
              <div className="text-sm text-foreground">14:22:05</div>
              <div className="text-sm text-muted-foreground">BTM → SGP (BTM-SGP-092)</div>
              <div className="text-sm text-foreground">15:00 (Delayed)</div>
              <div className="text-sm text-success">0.4 tCO₂e</div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-4 gap-4 p-6 border-b border-border items-center">
              <div className="text-sm text-foreground">13:45:12</div>
              <div className="text-sm text-muted-foreground">JKT → BTM (JKT-BTM-441)</div>
              <div className="text-sm text-foreground">14:15 (On Time)</div>
              <div className="text-sm text-success">1.2 tCO₂e</div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-4 gap-4 p-6 border-b border-border items-center">
              <div className="text-sm text-foreground">12:30:00</div>
              <div className="text-sm text-muted-foreground">SGP → BTM (SGP-BTM-118)</div>
              <div className="text-sm text-foreground">13:00 (On Time)</div>
              <div className="text-sm text-success">0.8 tCO₂e</div>
            </div>
          </div>
        </Card>
      </div>

    </div>
  );
}
