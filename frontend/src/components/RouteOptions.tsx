import { Clock, DollarSign, Leaf, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function RouteOptions() {
  return (
    <>
      {/* Route Alpha (Selected) */}
      <Card className="bg-primary text-primary-foreground border-transparent rounded-3xl cursor-pointer transition-transform hover:scale-[1.02] shadow-sm">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1 opacity-90">Fastest Option</p>
              <h3 className="text-2xl font-serif">Route Alpha</h3>
            </div>
            <Badge variant="secondary" className="bg-background text-primary hover:bg-background/90 text-[10px] font-bold px-3 py-1 rounded-full uppercase">
              Selected
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="flex items-center gap-1.5 opacity-80 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Duration</span>
              </div>
              <p className="text-lg font-bold">45 mins</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 opacity-80 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Est. Cost</span>
              </div>
              <p className="text-lg font-bold">$125.00</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 opacity-80 mb-1">
                <Leaf className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">CO2 Offset</span>
              </div>
              <p className="text-sm font-bold">+12%</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 opacity-80 mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Eco Score</span>
              </div>
              <p className="text-sm font-bold">A-</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Route Beta */}
      <Card className="bg-card text-card-foreground border-border rounded-3xl cursor-pointer transition-transform hover:scale-[1.02] shadow-none hover:border-primary/30">
        <CardContent className="p-6">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-wider mb-1 text-green-600">Greenest</p>
            <h3 className="text-2xl font-serif">Route Beta</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Duration</span>
              </div>
              <p className="text-lg font-bold">1h 15m</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Est. Cost</span>
              </div>
              <p className="text-lg font-bold">$95.00</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Leaf className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">CO2 Offset</span>
              </div>
              <p className="text-sm font-bold text-green-600">+45%</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Eco Score</span>
              </div>
              <p className="text-sm font-bold text-green-600">A+</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Route Gamma */}
      <Card className="bg-card text-card-foreground border-border rounded-3xl cursor-pointer transition-transform hover:scale-[1.02] shadow-none hover:border-primary/30">
        <CardContent className="p-6">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-wider mb-1 text-blue-600">Most Reliable</p>
            <h3 className="text-2xl font-serif">Route Gamma</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Duration</span>
              </div>
              <p className="text-lg font-bold">55 mins</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Est. Cost</span>
              </div>
              <p className="text-lg font-bold">$110.00</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Leaf className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">CO2 Offset</span>
              </div>
              <p className="text-sm font-bold text-green-500">+8%</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Eco Score</span>
              </div>
              <p className="text-sm font-bold">B+</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
