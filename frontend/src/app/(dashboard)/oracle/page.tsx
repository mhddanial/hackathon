"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Trash2, Paperclip, Send, BarChart2, Database, Bot, Sparkles, MessageSquare } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Message = {
  role: "user" | "agent";
  content: string;
};

export default function OracleChatPage() {
  const initialMessage: Message = {
    role: "agent",
    content: "Good morning! I'm the Logistic Oracle. I can analyze congestion, check ferry schedules, or optimize routes. How can I assist you today?",
  };

  const [messages, setMessages] = useState<Message[]>([initialMessage]);
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

  const handleClear = () => {
    setMessages([initialMessage]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex justify-between items-end mb-6 shrink-0">
        <div>
          <h1 className="text-[28px] font-semibold text-[#1A1D27] mb-1 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#2563EB]" />
            Logistic Oracle
          </h1>
          <p className="text-sm text-[#5E6470]">AI-powered logistics intelligence</p>
        </div>
        <Button onClick={handleClear} variant="outline" className="rounded-lg px-4 h-10 bg-white border-[#E2E8F0] text-[#EF4444] hover:bg-[#FEF2F2] hover:text-[#DC2626] shadow-sm font-medium transition-colors">
          <Trash2 className="w-4 h-4 mr-2" />
          Clear Chat
        </Button>
      </div>

      {/* Main Chat Area */}
      <Card className="rounded-2xl shadow-sm border-[#E2E8F0] bg-white flex flex-col flex-1 overflow-hidden">
        
        {/* Chat Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-[#F8F9FB]/50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex max-w-[80%] ${msg.role === "user" ? "self-end justify-end" : ""}`}>
              {msg.role === "agent" ? (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl rounded-tl-sm p-4 text-[14px] text-[#1A1D27] leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="bg-[#2563EB] text-white rounded-2xl rounded-tr-sm p-4 text-[14px] shadow-md whitespace-pre-wrap">
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
                <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl rounded-tl-sm p-4 text-[14px] text-[#1A1D27] leading-relaxed flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#94A3B8] rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-[#94A3B8] rounded-full animate-bounce delay-75"></span>
                  <span className="w-1.5 h-1.5 bg-[#94A3B8] rounded-full animate-bounce delay-150"></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-[#E2E8F0] flex flex-col gap-4">
          
          {/* Suggestion Chips */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
            <button onClick={() => handleSend("What is the congestion at Yos Sudarso right now?")} className="flex items-center gap-2 bg-[#F1F5F9] text-[#475569] text-xs font-medium px-4 py-2.5 rounded-full hover:bg-[#E2E8F0] transition-colors whitespace-nowrap border border-[#E2E8F0]">
              <BarChart2 className="w-3.5 h-3.5 text-[#2563EB]" />
              Congestion at Yos Sudarso?
            </button>
            <button onClick={() => handleSend("Any ferry schedules from Batam Center to Singapore today?")} className="flex items-center gap-2 bg-[#F1F5F9] text-[#475569] text-xs font-medium px-4 py-2.5 rounded-full hover:bg-[#E2E8F0] transition-colors whitespace-nowrap border border-[#E2E8F0]">
              <Database className="w-3.5 h-3.5 text-[#2563EB]" />
              Ferry to Singapore
            </button>
            <button onClick={() => handleSend("What is the optimal route from 1.129, 104.049 to 1.163, 104.004?")} className="flex items-center gap-2 bg-[#F1F5F9] text-[#475569] text-xs font-medium px-4 py-2.5 rounded-full hover:bg-[#E2E8F0] transition-colors whitespace-nowrap border border-[#E2E8F0]">
              <MessageSquare className="w-3.5 h-3.5 text-[#2563EB]" />
              Optimal route
            </button>
          </div>

          {/* Input Box */}
          <div className="border border-[#E2E8F0] rounded-xl flex items-center p-2 focus-within:border-[#2563EB] focus-within:ring-4 focus-within:ring-[#2563EB]/10 transition-all shadow-sm bg-white">
            <Button variant="ghost" size="icon" className="text-[#94A3B8] hover:text-[#2563EB] hover:bg-blue-50 shrink-0 rounded-lg">
              <Paperclip className="w-5 h-5" />
            </Button>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder="Ask Oracle about congestion, routes, or schedules..." 
              className="flex-1 bg-transparent border-none outline-none text-[15px] px-3 py-2 text-[#1A1D27] placeholder:text-[#94A3B8]"
            />
            <Button onClick={() => handleSend(input)} disabled={loading || !input.trim()} size="icon" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white shrink-0 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
