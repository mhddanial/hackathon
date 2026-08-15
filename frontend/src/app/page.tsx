import MapView from "@/components/MapView";
import RouteOptions from "@/components/RouteOptions";
import { Clock, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif text-foreground mb-1">Route Intelligence</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-primary">Batam Warehouse</span>
            <span>→</span>
            <span className="font-semibold text-foreground">Batu Ampar Terminal</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-foreground bg-accent hover:bg-accent/80 border-transparent">
            <Clock className="w-4 h-4" />
            Departs in 4h 30m
          </Badge>
          <Button variant="secondary" size="icon" className="w-11 h-11 rounded-full bg-accent hover:bg-accent/80 text-foreground border-transparent shadow-none">
            <Filter className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main Content: Left Column (Routes) & Right Column (Map) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-220px)] min-h-[600px]">
        {/* Left Column */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto pr-2 pb-8">
          <RouteOptions />
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8 relative rounded-[32px] overflow-hidden shadow-sm border border-border">
          <MapView />
        </div>
      </div>
    </div>
  );
}
