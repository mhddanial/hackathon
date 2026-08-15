import { Bot, History, Paperclip, Send, BarChart2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ChatWidget() {
  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground relative shadow-md">
            <Bot className="w-6 h-6" />
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full"></div>
          </div>
          <div>
            <h2 className="text-xl font-serif text-foreground">Logistics Oracle</h2>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              ONLINE & READY
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full text-foreground hover:bg-accent">
          <History className="w-5 h-5" />
        </Button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-6 pr-4 pb-8">
        {/* Agent Message */}
        <div className="flex">
          <div className="max-w-[80%] bg-accent/50 px-6 py-4 rounded-3xl rounded-tl-sm text-foreground text-[15px] leading-relaxed">
            Good morning, Alex. I've analyzed today's manifest across the Singapore-Batam corridor. How can I assist with your logistics planning?
          </div>
        </div>

        {/* User Message */}
        <div className="flex justify-end">
          <div className="max-w-[80%] bg-foreground text-background px-6 py-4 rounded-3xl rounded-tr-sm text-[15px] leading-relaxed">
            What's the best time for a heavy equipment run to Batu Ampar today? Consider current terminal congestion.
          </div>
        </div>

        {/* Agent Message with Card */}
        <div className="flex">
          <div className="max-w-[80%] bg-accent/50 px-6 py-4 rounded-3xl rounded-tl-sm text-foreground text-[15px] leading-relaxed flex flex-col gap-4">
            <p>Based on current terminal telemetry and historical ferry cycles, I recommend scheduling the heavy equipment run between <span className="text-primary font-semibold">14:00 - 15:30</span>.</p>
            
            {/* Rich Card inside chat */}
            <Card className="rounded-2xl border border-border flex items-center gap-6 relative overflow-hidden shadow-sm">
               <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
               <CardContent className="flex-1 p-4 pl-6 flex items-center gap-6">
                 <div className="flex-1">
                   <div className="flex items-center gap-2 text-muted-foreground mb-3">
                     <BarChart2 className="w-4 h-4" />
                     <span className="text-xs uppercase tracking-wider font-bold">Traffic Summary: Batu Ampar</span>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-y-2 text-sm">
                     <span className="text-muted-foreground">Current Congestion:</span>
                     <span className="text-destructive text-right font-semibold">High (82%)</span>
                     
                     <span className="text-muted-foreground">Expected Dip:</span>
                     <span className="text-foreground text-right font-semibold">14:15 - 15:45</span>
                     
                     <span className="text-muted-foreground">Ferry Sync:</span>
                     <span className="text-foreground text-right font-semibold">Breeze Runner ETA 14:10</span>
                   </div>
                 </div>
                 
                 {/* Progress Ring Mock */}
                 <div className="w-16 h-16 rounded-full border-4 border-accent border-t-destructive border-r-destructive border-b-destructive flex items-center justify-center">
                   <span className="text-xs font-bold text-destructive">82%</span>
                 </div>
               </CardContent>
            </Card>

            <p>Shall I draft the clearance documentation for the 14:00 slot?</p>
          </div>
        </div>
      </div>

      {/* Bottom Input Area */}
      <div className="mt-auto">
        {/* Suggestion Chips */}
        <div className="flex gap-3 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          <Button variant="outline" className="rounded-full font-semibold hover:border-primary/50 text-foreground bg-background">
            Draft clearance docs for 14:00
          </Button>
          <Button variant="outline" className="rounded-full font-semibold hover:border-primary/50 text-foreground bg-background">
            Current wait times at Sekupang?
          </Button>
          <Button variant="outline" className="rounded-full font-semibold hover:border-primary/50 text-foreground bg-background">
            Any weather delays expected?
          </Button>
        </div>

        {/* Input Box */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Paperclip className="w-5 h-5" />
          </div>
          <Input 
            type="text" 
            placeholder="Ask Oracle..." 
            className="w-full h-14 bg-background border-border rounded-2xl pl-12 pr-14 text-[15px] focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
          />
          <Button size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
            <Send className="w-4 h-4 ml-0.5" />
          </Button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-3 font-medium">
          Oracle may occasionally produce inaccurate predictions. Verify critical timings.
        </p>
      </div>
    </div>
  );
}
