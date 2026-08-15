"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SlidersHorizontal, Ship, Leaf, Anchor, Map, RefreshCw, ArrowRight } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface Schedule {
  id: string;
  terminal_name: string;
  destination: string;
  departure_times: string[];
}

export default function DashboardPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [batuAmparCongestion, setBatuAmparCongestion] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);

    // Fetch schedules independently — don't let one failure block the other
    try {
      const schedRes = await fetch(`${API_URL}/schedules`);
      if (schedRes.ok) {
        const schedData = await schedRes.json();
        setSchedules(schedData.schedules || []);
      }
    } catch (error) {
      console.warn("Could not load schedules:", error);
    }

    // Fetch congestion for Yos Sudarso (SEG001) — a valid segment in our DB
    try {
      const hour = new Date().getHours();
      const congRes = await fetch(`${API_URL}/congestion?segment_id=SEG001&day_type=weekday&hour=${hour}`);
      if (congRes.ok) {
        const congData = await congRes.json();
        setBatuAmparCongestion(congData);
      }
    } catch (error) {
      console.warn("Could not load congestion data:", error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Extract upcoming departures
  const upcomingDepartures = schedules.flatMap(s =>
    (s.departure_times || []).map(t => ({
      route: `${s.terminal_name} → ${s.destination === "Singapore" ? "SGP" : s.destination}`,
      time: t
    }))
  ).sort((a, b) => a.time.localeCompare(b.time)).slice(0, 3);

  // API returns { congestion_level: "HIGH", multiplier: 1.8 }
  const multiplierToPct: Record<string, number> = { "LOW": 30, "MEDIUM": 60, "HIGH": 82, "VERY_HIGH": 95 };
  const congestionLevel = batuAmparCongestion?.congestion_level || "HIGH";
  const congestionPct = multiplierToPct[congestionLevel] ?? 82;
  const isHighCongestion = congestionPct > 55;

  // Color helpers for congestion level badges
  const congestionBadge = (level: string) => {
    const map: Record<string, { text: string; className: string }> = {
      LOW: { text: "Clear", className: "text-[#10B981] bg-[#ECFDF5] border border-[#A7F3D0]" },
      MEDIUM: { text: "Moderate", className: "text-[#F59E0B] bg-[#FEF3C7] border border-[#FDE68A]" },
      HIGH: { text: "Heavy Traffic", className: "text-[#EF4444] bg-[#FEF2F2] border border-[#FECACA]" },
      VERY_HIGH: { text: "Severe", className: "text-[#DC2626] bg-[#FEE2E2] border border-[#FECACA]" },
    };
    return map[level] || map["LOW"];
  };

  return (
    <div className="flex flex-col bg-[#F8F9FB] rounded-tl-3xl p-8 overflow-y-auto min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-[28px] font-semibold text-[#1A1D27] mb-1">Logistic Overview</h1>
          <p className="text-sm text-[#5E6470]">Real-time network performance and sustainability impact</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchDashboardData} variant="outline" className="rounded-lg px-4 h-10 border-[#E2E8F0] text-[#5E6470] bg-white shadow-sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" className="rounded-lg px-4 h-10 border-[#E2E8F0] text-[#5E6470] bg-white shadow-sm">
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Top 3 Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        
        {/* Primary Corridors */}
        <Card className="rounded-[16px] p-6 shadow-sm border-[#E2E8F0] bg-white flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <Map className="w-5 h-5 text-[#2563EB]" />
            <h3 className="text-sm font-medium text-[#1A1D27]">Primary Corridors</h3>
          </div>
          <div className="flex flex-col gap-4 mt-auto">
            <div className="flex justify-between items-center">
              <span className="text-base font-medium text-[#1A1D27]">Yos Sudarso</span>
              {loading ? (
                <span className="text-[11px] text-[#94A3B8] px-3 py-1 rounded-md border border-[#E2E8F0]">Loading...</span>
              ) : (
                <span className={`text-[11px] font-medium px-3 py-1 rounded-md ${congestionBadge(congestionLevel).className}`}>
                  {congestionBadge(congestionLevel).text}
                </span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base font-medium text-[#1A1D27]">Sudirman</span>
              <span className="text-[11px] font-medium text-[#10B981] bg-[#ECFDF5] border border-[#A7F3D0] px-3 py-1 rounded-md">Clear</span>
            </div>
          </div>
        </Card>

        {/* Next Ferry Departures */}
        <Card className="rounded-[16px] p-6 shadow-sm border-[#E2E8F0] bg-white flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <Ship className="w-5 h-5 text-[#2563EB]" />
            <h3 className="text-sm font-medium text-[#1A1D27]">Next Ferry Departures</h3>
          </div>
          <div className="flex flex-col gap-4 mt-auto">
            {loading ? (
               <span className="text-sm text-[#94A3B8]">Loading schedules...</span>
            ) : upcomingDepartures.length > 0 ? (
              upcomingDepartures.map((dep, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-base font-medium text-[#1A1D27] truncate pr-2" title={dep.route}>{dep.route}</span>
                  <span className="text-base font-semibold text-[#1A1D27]">{dep.time}</span>
                </div>
              ))
            ) : (
               <span className="text-sm text-[#94A3B8]">No upcoming departures</span>
            )}
          </div>
        </Card>

        {/* Total Emission Saved */}
        <Card className="rounded-[16px] p-6 shadow-sm border-[#E2E8F0] bg-white flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <Leaf className="w-5 h-5 text-[#10B981]" />
            <h3 className="text-sm font-medium text-[#1A1D27]">Total Emission Saved</h3>
          </div>
          <div className="mt-auto">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[40px] font-semibold text-[#10B981] leading-none">42.8</span>
              <span className="text-lg font-bold text-[#10B981]">tCO₂e</span>
            </div>
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">+12% VS LAST MONTH</p>
            <p className="text-[9px] text-[#CBD5E1] mt-1">(estimated based on route optimization)</p>
          </div>
        </Card>

      </div>

      {/* Middle Section: 2 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        
        {/* Batu Ampar Port Card */}
        <Card className="rounded-[16px] p-6 md:p-8 shadow-sm border-[#E2E8F0] bg-white flex flex-col justify-between">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
              <Anchor className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#1A1D27]">Batu Ampar Port</h3>
              <p className="text-sm text-[#5E6470] mt-0.5">Current Terminal Status</p>
            </div>
          </div>
          
          <div className="mb-10">
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-[56px] font-medium text-[#1A1D27] leading-none">{loading ? '...' : `${congestionPct}%`}</span>
              {!loading && isHighCongestion && <span className="text-sm font-semibold text-[#EF4444]">High</span>}
            </div>
            <p className="text-sm text-[#5E6470] max-w-sm">
              {isHighCongestion ? "Capacity reached. Expect berthing delays of up to 4 hours for non-priority vessels." : "Terminal operating at normal capacity. No significant delays expected."}
            </p>
          </div>
          
          <div>
            <div className="flex justify-between text-xs font-bold mb-3">
              <span className="text-[#1A1D27]">Berth Availability</span>
              <span className="text-[#1A1D27]">{isHighCongestion ? '2 / 12 Open' : '8 / 12 Open'}</span>
            </div>
            <div className="h-3 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
              <div className={`h-full ${isHighCongestion ? 'bg-[#EF4444]' : 'bg-[#10B981]'} rounded-full transition-all duration-1000`} style={{width: `${congestionPct}%`}}></div>
            </div>
          </div>
        </Card>

        {/* Carbon Savings Card */}
        <Card className="rounded-[16px] p-6 md:p-8 shadow-sm border-[#E2E8F0] bg-white flex flex-col justify-between">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-full bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
              <Leaf className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#1A1D27]">Carbon Savings</h3>
              <p className="text-sm text-[#5E6470] mt-0.5">Daily routing optimization</p>
            </div>
          </div>
          
          <div className="mb-6">
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-[56px] font-medium text-[#10B981] leading-none">1.4</span>
              <span className="text-lg font-bold text-[#10B981]">tCO₂e</span>
            </div>
            <p className="text-sm text-[#5E6470]">
              Prevented today by bypassing Yos Sudarso congestion.
            </p>
          </div>
          
          {/* Custom Bar Chart matching mockup */}
          <div className="flex items-end justify-between h-32 mt-4 gap-4 px-2">
            <div className="flex flex-col items-center flex-1 gap-3">
              <div className="w-full bg-[#F1F5F9] rounded-t-md h-[30%]"></div>
              <span className="text-xs font-semibold text-[#1A1D27]">Mon</span>
            </div>
            <div className="flex flex-col items-center flex-1 gap-3">
              <div className="w-full bg-[#F1F5F9] rounded-t-md h-[40%]"></div>
              <span className="text-xs font-semibold text-[#1A1D27]">Tue</span>
            </div>
            <div className="flex flex-col items-center flex-1 gap-3">
              <div className="w-full bg-[#F1F5F9] rounded-t-md h-[25%]"></div>
              <span className="text-xs font-semibold text-[#1A1D27]">Wed</span>
            </div>
            <div className="flex flex-col items-center flex-1 gap-3">
              <div className="w-full bg-[#F1F5F9] rounded-t-md h-[60%]"></div>
              <span className="text-xs font-semibold text-[#1A1D27]">Thu</span>
            </div>
            <div className="flex flex-col items-center flex-1 gap-3 relative">
              <span className="absolute -top-7 text-sm font-bold text-[#10B981]">1.4</span>
              <div className="w-full bg-[#10B981] rounded-t-md h-[90%]"></div>
              <span className="text-xs font-semibold text-[#10B981]">Today</span>
            </div>
          </div>
        </Card>
        
      </div>

      {/* Bottom Section: Quick Actions — replaces fake activity table */}
      <div className="mb-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-[#1A1D27] mb-1">Quick Actions</h2>
          <p className="text-sm text-[#5E6470]">Start optimizing your logistics flow</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/planner" className="group block">
            <Card className="rounded-[16px] p-6 shadow-sm border-[#E2E8F0] bg-white hover:border-[#2563EB] hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                    <Map className="w-5 h-5 text-[#2563EB]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1A1D27]">Plan a Route</p>
                    <p className="text-xs text-[#94A3B8]">Optimize origin to destination</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#2563EB] transition-colors" />
              </div>
            </Card>
          </a>

          <a href="/schedules" className="group block">
            <Card className="rounded-[16px] p-6 shadow-sm border-[#E2E8F0] bg-white hover:border-[#2563EB] hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                    <Ship className="w-5 h-5 text-[#2563EB]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1A1D27]">Ferry Schedules</p>
                    <p className="text-xs text-[#94A3B8]">View today&apos;s departure times</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#2563EB] transition-colors" />
              </div>
            </Card>
          </a>

          <a href="/oracle" className="group block">
            <Card className="rounded-[16px] p-6 shadow-sm border-[#E2E8F0] bg-white hover:border-[#2563EB] hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                    <Leaf className="w-5 h-5 text-[#2563EB]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1A1D27]">Ask Oracle</p>
                    <p className="text-xs text-[#94A3B8]">AI logistics assistant</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#2563EB] transition-colors" />
              </div>
            </Card>
          </a>
        </div>
      </div>

    </div>
  );
}
