"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { History, Send, Paperclip } from "lucide-react";

export default function OracleChatPage() {
  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] relative overflow-hidden">
      
      {/* Blurred Map Background */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center opacity-10 filter blur-[8px]"></div>
      
      <div className="relative z-10 flex flex-col h-full p-6 md:p-8">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-blue-700 flex items-center justify-center relative shadow-md">
               <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-[#FAFAFA]"></span>
               <span className="text-white font-bold text-xs">AI</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">Logistics Oracle</h1>
              <p className="text-[10px] font-bold text-success uppercase tracking-widest flex items-center gap-1">
                ONLINE & READY
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-muted/30">
            <History className="w-5 h-5" />
          </Button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto flex flex-col justify-start pb-8 gap-6 no-scrollbar">
          
          {/* AI Message */}
          <div className="flex gap-4 max-w-2xl">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 shadow-sm border border-blue-200">
               <span className="text-[10px] font-bold text-blue-700">AI</span>
            </div>
            <div className="bg-white border border-border/50 rounded-2xl rounded-tl-sm p-4 shadow-sm text-sm text-foreground leading-relaxed">
              Halo! Saya adalah <strong>Logistics Oracle</strong>, asisten AI cerdas Anda. Saya memiliki akses ke seluruh data sistem (rute, jadwal, cuaca, dan kondisi pelabuhan). 
              <br/><br/>
              Cukup beri tahu saya apa yang Anda butuhkan dengan bahasa sehari-hari. Contohnya: <em>"Carikan rute terbaik ke Batu Ampar"</em> atau <em>"Apa ada penundaan cuaca hari ini?"</em>
            </div>
          </div>

        </div>

        {/* Input Area */}
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-4 mt-auto">
          
          {/* Suggestion Chips */}
          <div className="flex flex-wrap gap-2">
            <div className="bg-white/80 hover:bg-white backdrop-blur-md border border-border/50 text-foreground text-xs font-medium px-4 py-2.5 rounded-full cursor-pointer shadow-sm transition-colors hover:border-blue-300">
              Carikan rute ke Batu Aji
            </div>
            <div className="bg-white/80 hover:bg-white backdrop-blur-md border border-border/50 text-foreground text-xs font-medium px-4 py-2.5 rounded-full cursor-pointer shadow-sm transition-colors hover:border-blue-300">
              Cek waktu tunggu di Sekupang
            </div>
            <div className="bg-white/80 hover:bg-white backdrop-blur-md border border-border/50 text-foreground text-xs font-medium px-4 py-2.5 rounded-full cursor-pointer shadow-sm transition-colors hover:border-blue-300">
              Draft dokumen clearance
            </div>
          </div>

          {/* Input Box */}
          <div className="bg-white rounded-xl shadow-md border border-border/50 flex items-center p-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-muted/30 shrink-0">
              <Paperclip className="w-5 h-5" />
            </Button>
            <input 
              type="text" 
              placeholder="Ask Oracle..." 
              className="flex-1 bg-transparent border-none outline-none text-sm px-3 text-foreground placeholder:text-muted-foreground"
            />
            <Button size="icon" className="bg-blue-700 hover:bg-blue-800 text-white shrink-0 rounded-lg shadow-sm">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          
          <p className="text-[9px] text-muted-foreground text-center mt-2 font-medium">
            Oracle may occasionally produce inaccurate predictions. Verify critical timings.
          </p>

        </div>
      </div>
    </div>
  );
}
