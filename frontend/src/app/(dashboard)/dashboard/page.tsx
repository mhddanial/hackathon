"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, SlidersHorizontal, Download, Ship, Leaf, Anchor, Map } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="flex flex-col bg-[#F8F9FB] rounded-tl-3xl p-8 overflow-y-auto min-h-screen">
      


      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-[28px] font-semibold text-[#1A1D27] mb-1">Logistic Overview</h1>
          <p className="text-sm text-[#5E6470]">Real-time network performance and sustainability impact</p>
        </div>
        <Button variant="outline" className="rounded-lg px-4 h-10 border-[#E2E8F0] text-[#5E6470] bg-white shadow-sm">
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Filter
        </Button>
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
              <span className="text-[11px] font-medium text-[#EF4444] bg-[#FEF2F2] border border-[#FECACA] px-3 py-1 rounded-md">Status</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base font-medium text-[#1A1D27]">Sudirman</span>
              <span className="text-[11px] font-medium text-[#10B981] bg-[#ECFDF5] border border-[#A7F3D0] px-3 py-1 rounded-md">Status</span>
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
            <div className="flex justify-between items-center">
              <span className="text-base font-medium text-[#1A1D27]">Batam Center → SGP</span>
              <span className="text-base font-semibold text-[#1A1D27]">14:30</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base font-medium text-[#1A1D27]">Batu Ampar → JKT</span>
              <span className="text-base font-semibold text-[#1A1D27]">15:15</span>
            </div>
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
              <span className="text-[56px] font-medium text-[#1A1D27] leading-none">82%</span>
              <span className="text-sm font-semibold text-[#EF4444]">~+5%</span>
            </div>
            <p className="text-sm text-[#5E6470] max-w-sm">
              Capacity reached. Expect berthing delays of up to 4 hours for non-priority vessels.
            </p>
          </div>
          
          <div>
            <div className="flex justify-between text-xs font-bold mb-3">
              <span className="text-[#1A1D27]">Berth Availability</span>
              <span className="text-[#1A1D27]">2 / 12 Open</span>
            </div>
            <div className="h-3 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
              <div className="h-full bg-[#EF4444] w-[82%] rounded-full"></div>
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

      {/* Bottom Section: Recent Activity History */}
      <div className="mb-8">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-[#1A1D27] mb-1">Recent Activity History</h2>
            <p className="text-sm text-[#5E6470]">Logistics optimization and routing logs</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="rounded-lg px-4 h-10 border-[#E2E8F0] text-[#5E6470] bg-white shadow-sm">
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" className="rounded-lg px-4 h-10 border-[#E2E8F0] text-[#5E6470] bg-white shadow-sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        
        <Card className="rounded-[16px] overflow-hidden shadow-sm border-[#E2E8F0] bg-white">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#EFF6FF] text-[#1A1D27]">
                <tr>
                  <th className="px-6 py-4 font-semibold text-xs border-b border-[#E2E8F0]">Time Stamp</th>
                  <th className="px-6 py-4 font-semibold text-xs border-b border-[#E2E8F0]">Origin/Destination</th>
                  <th className="px-6 py-4 font-semibold text-xs border-b border-[#E2E8F0]">Recomended Departure</th>
                  <th className="px-6 py-4 font-semibold text-xs border-b border-[#E2E8F0]">Emission Saved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                <tr className="hover:bg-muted/30">
                  <td className="px-6 py-4 text-[#5E6470]">CL2026080100018</td>
                  <td className="px-6 py-4 text-[#5E6470]">920000000110</td>
                  <td className="px-6 py-4 text-[#5E6470]">Digital Weighing Scale</td>
                  <td className="px-6 py-4 text-[#5E6470]">SP28</td>
                </tr>
                <tr className="hover:bg-muted/30">
                  <td className="px-6 py-4 text-[#5E6470]">CL2026080900020</td>
                  <td className="px-6 py-4 text-[#5E6470]">920000000103</td>
                  <td className="px-6 py-4 text-[#5E6470]">Vernier Caliper</td>
                  <td className="px-6 py-4 text-[#5E6470]">SP28</td>
                </tr>
                <tr className="hover:bg-muted/30">
                  <td className="px-6 py-4 text-[#5E6470]">CL2026081100006</td>
                  <td className="px-6 py-4 text-[#5E6470]">920000001129</td>
                  <td className="px-6 py-4 text-[#5E6470]">Pressure Gauge</td>
                  <td className="px-6 py-4 text-[#5E6470]">SP22</td>
                </tr>
                <tr className="hover:bg-muted/30">
                  <td className="px-6 py-4 text-[#5E6470]">CL2026080500213</td>
                  <td className="px-6 py-4 text-[#5E6470]">920000000234</td>
                  <td className="px-6 py-4 text-[#5E6470]">Torque Wrench</td>
                  <td className="px-6 py-4 text-[#5E6470]">IS13</td>
                </tr>
                <tr className="hover:bg-muted/30">
                  <td className="px-6 py-4 text-[#5E6470]">CL2026090100016</td>
                  <td className="px-6 py-4 text-[#5E6470]">920000000008</td>
                  <td className="px-6 py-4 text-[#5E6470]">Digital Thermometer</td>
                  <td className="px-6 py-4 text-[#5E6470]">SP22</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

    </div>
  );
}
