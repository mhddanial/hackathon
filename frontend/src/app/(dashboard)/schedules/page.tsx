"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, MapPin, Calendar, Ship, CheckCircle2, RefreshCw, Anchor } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Schedule {
  id: string;
  terminal_id: string;
  terminal_name: string;
  destination: string;
  departure_time: string;
  cutoff_time: string;
  vessel_type: string;
  cargo_capacity_tons: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function FerrySchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTerminal, setSelectedTerminal] = useState("all");

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/schedules`);
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch (error) {
      console.error("Failed to fetch schedules", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const filteredSchedules = selectedTerminal === "all" 
    ? schedules 
    : schedules.filter(s => s.terminal_id.toLowerCase() === selectedTerminal.toLowerCase());

  const terminals = [
    { id: "all", name: "All Terminals" },
    { id: "TM001", name: "Batu Ampar Port" },
    { id: "TM002", name: "Batam Center Ferry Terminal" },
    { id: "TM003", name: "Sekupang Ferry Terminal" }
  ];

  return (
    <div className="flex flex-col bg-[#F8F9FB] rounded-tl-3xl p-8 overflow-y-auto min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-[28px] font-semibold text-[#1A1D27] mb-1">Live Port Schedules</h1>
          <p className="text-sm text-[#5E6470]">Real-time departure boards and manifest capacity.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchSchedules} variant="outline" className="rounded-lg px-4 h-10 bg-white border-[#E2E8F0] text-[#5E6470] hover:bg-slate-50 shadow-sm font-medium">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
          <Button variant="outline" className="rounded-lg px-4 h-10 bg-white border-[#E2E8F0] text-[#5E6470] hover:bg-slate-50 shadow-sm font-medium">
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-8">
        
        {/* Left Column: Metric Cards */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <Card className="rounded-[16px] overflow-hidden shadow-sm border-[#E2E8F0] bg-white">
            <div className="p-6">
              <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] mb-4">
                <Ship className="w-5 h-5" />
              </div>
              <span className="text-[32px] font-bold text-[#1A1D27] leading-none block mb-1">
                {loading ? "--" : schedules.length}
              </span>
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Total Daily Trips</span>
            </div>
          </Card>
          
          <Card className="rounded-[16px] overflow-hidden shadow-sm border-[#E2E8F0] bg-white">
            <div className="p-6">
              <div className="w-10 h-10 rounded-full bg-[#F0FDF4] flex items-center justify-center text-[#16A34A] mb-4">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-[32px] font-bold text-[#1A1D27] leading-none block mb-1">
                {loading ? "--" : "98%"}
              </span>
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">On-Time Performance</span>
            </div>
          </Card>
        </div>

        {/* Right Column: Table area with Tabs */}
        <div className="lg:col-span-9 flex flex-col">
          <Card className="rounded-[16px] shadow-sm border-[#E2E8F0] bg-white flex flex-col overflow-hidden w-full h-[600px]">
            
            <Tabs defaultValue="all" value={selectedTerminal} onValueChange={setSelectedTerminal} className="w-full flex-1 flex flex-col">
              
              <div className="flex justify-between items-center p-4 border-b border-[#E2E8F0] bg-[#F8F9FB]/50">
                <TabsList className="bg-transparent space-x-2">
                  {terminals.map(term => (
                    <TabsTrigger 
                      key={term.id} 
                      value={term.id}
                      className="rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#2563EB] text-[#5E6470]"
                    >
                      {term.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                <div className="flex items-center bg-white px-4 py-2 rounded-lg border border-[#E2E8F0]">
                  <Calendar className="w-4 h-4 text-[#5E6470] mr-2" />
                  <span className="text-xs font-medium text-[#1A1D27]">{new Date().toLocaleDateString()}</span>
                </div>
              </div>

              <ScrollArea className="flex-1 w-full relative">
                {loading ? (
                  <div className="absolute inset-0 flex justify-center items-center text-[#5E6470] min-h-[300px]">
                    <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                    Fetching live schedules...
                  </div>
                ) : filteredSchedules.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-white sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                      <TableRow className="border-b border-[#E2E8F0] hover:bg-transparent">
                        <TableHead className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest px-6 py-4">Departure</TableHead>
                        <TableHead className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest px-6 py-4">Port Cut-off</TableHead>
                        <TableHead className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest px-6 py-4">Vessel / Terminal</TableHead>
                        <TableHead className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest px-6 py-4">Destination</TableHead>
                        <TableHead className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest px-6 py-4">Capacity</TableHead>
                        <TableHead className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest px-6 py-4 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSchedules.map((schedule) => (
                        <TableRow key={schedule.id} className="border-b border-[#E2E8F0] hover:bg-[#F8F9FB] transition-colors">
                          
                          <TableCell className="px-6 py-4">
                            <span className="text-sm font-bold text-[#1A1D27]">{schedule.departure_time.substring(0, 5)}</span>
                            <span className="text-[10px] text-[#5E6470] block mt-1">Boarding: -15m</span>
                          </TableCell>
                          
                          <TableCell className="px-6 py-4">
                            <Badge variant="outline" className="bg-[#FEF2F2] text-[#EF4444] border-transparent font-bold rounded-md">
                              {schedule.cutoff_time.substring(0, 5)}
                            </Badge>
                          </TableCell>
                          
                          <TableCell className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-md bg-[#F1F5F9] flex items-center justify-center shrink-0">
                                <Ship className="w-4 h-4 text-[#64748B]" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-[#1A1D27]">{schedule.vessel_type}</p>
                                <div className="flex items-center gap-1 text-[11px] text-[#94A3B8] mt-0.5">
                                  <Anchor className="w-3 h-3" /> {schedule.terminal_name}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell className="px-6 py-4">
                            <p className="text-sm font-medium text-[#1A1D27] flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-[#94A3B8]" />
                              {schedule.destination}
                            </p>
                          </TableCell>
                          
                          <TableCell className="px-6 py-4">
                            <Badge variant="secondary" className="font-semibold bg-[#F1F5F9] text-[#475569]">
                              {schedule.cargo_capacity_tons} Tons
                            </Badge>
                          </TableCell>
                          
                          <TableCell className="px-6 py-4 text-right">
                            <Badge className="bg-[#10B981] hover:bg-[#059669] text-white font-bold px-3 py-1 rounded-md border-0 uppercase tracking-widest text-[9px]">
                              Available
                            </Badge>
                          </TableCell>

                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center min-h-[300px]">
                    <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
                      <Ship className="w-8 h-8 text-[#94A3B8]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#1A1D27] mb-1">No schedules found</h3>
                    <p className="text-sm text-[#64748B] max-w-[250px] mb-4">
                      There are no scheduled departures for this terminal.
                    </p>
                    <Button onClick={() => setSelectedTerminal("all")} variant="outline" className="rounded-lg border-[#E2E8F0]">
                      View All Terminals
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
