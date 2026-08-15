"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, SlidersHorizontal, Paperclip, Send, BarChart2, Database } from "lucide-react";
import Link from "next/link";

export default function OracleChatPage() {
  return (
    <div className="flex flex-col bg-[#F8F9FB] rounded-tl-3xl p-8 overflow-y-auto min-h-screen">
      


      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-[28px] font-semibold text-[#1A1D27] mb-1">Logistic Oracle</h1>
          <p className="text-sm text-[#5E6470]">Online & Ready</p>
        </div>
        <Button variant="outline" className="rounded-lg px-4 h-10 bg-white border-[#E2E8F0] text-[#5E6470] hover:bg-slate-50 shadow-sm font-medium">
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Main Chat Area */}
      <Card className="rounded-[16px] shadow-sm border-[#E2E8F0] bg-white flex flex-col flex-1 relative overflow-hidden">
        
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
          
          {/* AI Message 1 */}
          <div className="flex max-w-[80%]">
            <div className="bg-[#F1F5F9] rounded-2xl rounded-tl-sm p-5 text-[13px] text-[#1A1D27] leading-relaxed">
              Good morning, Alex. I've analyzed today's manifest across the Singapore-Batam corridor. How can I assist with your logistics planning?
            </div>
          </div>

          {/* User Message */}
          <div className="flex max-w-[80%] self-end justify-end">
            <div className="bg-[#0F172A] text-white rounded-2xl rounded-tr-sm p-4 text-[13px] shadow-sm">
              Jam berapa paling aman ke Batu Ampar?
            </div>
          </div>

          {/* AI Message 2 (Complex) */}
          <div className="flex max-w-[80%]">
            <div className="bg-[#F1F5F9] rounded-2xl rounded-tl-sm p-5 text-[13px] text-[#1A1D27] leading-relaxed flex flex-col gap-4 w-full">
              
              {/* Status Pill */}
              <div className="flex items-center gap-2 bg-white/50 w-fit px-3 py-1.5 rounded-md border border-[#E2E8F0]">
                <Database className="w-3.5 h-3.5 text-[#2563EB]" />
                <span className="text-[9px] font-bold text-[#5E6470] uppercase tracking-widest">CALLING: CONGESTION_MODEL_V2</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] ml-1"></span>
              </div>

              {/* Text */}
              <p>
                Berdasarkan data real-time dari model kemacetan, waktu paling aman untuk ke Batu Ampar hari ini adalah antara <span className="text-[#2563EB] font-medium">14:00 - 15:30</span>.
              </p>

              {/* Data Card */}
              <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] flex justify-between items-center shadow-sm">
                <div className="flex flex-col gap-3 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart2 className="w-4 h-4 text-[#2563EB]" />
                    <span className="text-[13px] font-medium text-[#1A1D27]">Traffic Summary: Batu Ampar</span>
                  </div>
                  
                  <div className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-2 text-[12px]">
                    <span className="text-[#5E6470]">Current Congestion:</span>
                    <span className="text-[#EF4444] text-right">High (82%)</span>
                    
                    <span className="text-[#5E6470]">Expected Dip:</span>
                    <span className="text-[#1A1D27] text-right">14:15 - 15:45</span>
                    
                    <span className="text-[#5E6470]">Ferry Sync:</span>
                    <span className="text-[#1A1D27] text-right">Breeze Runner ETA 14:10</span>
                  </div>
                </div>

                {/* Circular Gauge Placeholder */}
                <div className="ml-8 relative w-16 h-16 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full stroke-[#EF4444] fill-none" strokeWidth="3.5" strokeDasharray="10, 2" strokeLinecap="round">
                     <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                </div>
              </div>

              <p>
                Apakah Anda ingin saya menyiapkan draf dokumen izin untuk slot jam 14:00?
              </p>

            </div>
          </div>
          
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-[#E2E8F0] flex flex-col gap-4">
          
          {/* Suggestion Chips */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            <div className="bg-[#F1F5F9] text-[#1A1D27] text-xs px-4 py-2 rounded-lg cursor-pointer hover:bg-[#E2E8F0] transition-colors whitespace-nowrap">
              Draft clearance docs for 14:00
            </div>
            <div className="bg-[#F1F5F9] text-[#1A1D27] text-xs px-4 py-2 rounded-lg cursor-pointer hover:bg-[#E2E8F0] transition-colors whitespace-nowrap">
              Current wait times at Sekupang?
            </div>
            <div className="bg-[#F1F5F9] text-[#1A1D27] text-xs px-4 py-2 rounded-lg cursor-pointer hover:bg-[#E2E8F0] transition-colors whitespace-nowrap">
              Any weather delays expected?
            </div>
          </div>

          {/* Input Box */}
          <div className="border border-[#E2E8F0] rounded-xl flex items-center p-2 focus-within:border-[#2563EB] transition-colors shadow-sm">
            <Button variant="ghost" size="icon" className="text-[#94A3B8] hover:text-[#5E6470] hover:bg-transparent shrink-0">
              <Paperclip className="w-5 h-5" />
            </Button>
            <input 
              type="text" 
              placeholder="Ask Oracle..." 
              className="flex-1 bg-transparent border-none outline-none text-sm px-2 text-[#1A1D27] placeholder:text-[#94A3B8]"
            />
            <Button size="icon" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white shrink-0 rounded-lg shadow-sm">
              <Send className="w-4 h-4" />
            </Button>
          </div>

        </div>

      </Card>
    </div>
  );
}
