"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, SlidersHorizontal, Paperclip, Send, BarChart2, Database, Bot } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Message = {
  role: "user" | "agent";
  content: string;
};

export default function OracleChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      content: "Good morning! I've analyzed today's manifest across the Singapore-Batam corridor. How can I assist with your logistics planning?",
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg = text.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "agent", content: data.reply || "Sorry, I couldn't process that." }]);
    } catch (error) {
      console.error("Chat error", error);
      setMessages((prev) => [...prev, { role: "agent", content: "Error connecting to Oracle API." }]);
    } finally {
      setLoading(false);
    }
  };

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
      <Card className="rounded-[16px] shadow-sm border-[#E2E8F0] bg-white flex flex-col flex-1 relative overflow-hidden min-h-[500px]">
        
        {/* Chat Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex max-w-[80%] ${msg.role === "user" ? "self-end justify-end" : ""}`}>
              {msg.role === "agent" ? (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-[#F1F5F9] rounded-2xl rounded-tl-sm p-5 text-[13px] text-[#1A1D27] leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="bg-[#0F172A] text-white rounded-2xl rounded-tr-sm p-4 text-[13px] shadow-sm whitespace-pre-wrap">
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex max-w-[80%]">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-[#F1F5F9] rounded-2xl rounded-tl-sm p-5 text-[13px] text-[#1A1D27] leading-relaxed flex items-center gap-1">
                  <span className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce delay-75"></span>
                  <span className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce delay-150"></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-[#E2E8F0] flex flex-col gap-4">
          
          {/* Suggestion Chips */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            <div onClick={() => handleSend("Draft clearance docs for 14:00")} className="bg-[#F1F5F9] text-[#1A1D27] text-xs px-4 py-2 rounded-lg cursor-pointer hover:bg-[#E2E8F0] transition-colors whitespace-nowrap">
              Draft clearance docs for 14:00
            </div>
            <div onClick={() => handleSend("Current wait times at Sekupang?")} className="bg-[#F1F5F9] text-[#1A1D27] text-xs px-4 py-2 rounded-lg cursor-pointer hover:bg-[#E2E8F0] transition-colors whitespace-nowrap">
              Current wait times at Sekupang?
            </div>
            <div onClick={() => handleSend("Any ferry schedules to PSA Keppel?")} className="bg-[#F1F5F9] text-[#1A1D27] text-xs px-4 py-2 rounded-lg cursor-pointer hover:bg-[#E2E8F0] transition-colors whitespace-nowrap">
              Any ferry schedules to PSA Keppel?
            </div>
          </div>

          {/* Input Box */}
          <div className="border border-[#E2E8F0] rounded-xl flex items-center p-2 focus-within:border-[#2563EB] transition-colors shadow-sm">
            <Button variant="ghost" size="icon" className="text-[#94A3B8] hover:text-[#5E6470] hover:bg-transparent shrink-0">
              <Paperclip className="w-5 h-5" />
            </Button>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
              placeholder="Ask Oracle..." 
              className="flex-1 bg-transparent border-none outline-none text-sm px-2 text-[#1A1D27] placeholder:text-[#94A3B8]"
            />
            <Button onClick={() => handleSend(input)} disabled={loading || !input.trim()} size="icon" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white shrink-0 rounded-lg shadow-sm">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
