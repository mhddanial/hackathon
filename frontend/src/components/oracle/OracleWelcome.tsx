import { ArrowUpRight, Route, Ship, Sparkles, TrafficCone } from "lucide-react";
import { Button } from "@/components/ui/button";

const prompts = [
  {
    title: "Plan a route",
    description: "Estimate travel time and view your route.",
    icon: Route,
    prompt:
      "Estimate a fast freight route from Batamindo Industrial Park to Batu Ampar Port on a weekday at 10:00 WIB, with vessel ETD at 19:00 WIB.",
  },
  {
    title: "Check congestion",
    description: "Explore an estimate for a specific road.",
    icon: TrafficCone,
    prompt: "Estimate Yos Sudarso congestion on a weekday at 08:00.",
  },
  {
    title: "Find a ferry",
    description: "Look up recorded departures and terminals.",
    icon: Ship,
    prompt: "Show recorded ferry departures from Batu Ampar.",
  },
];

export function OracleWelcome({
  disabled,
  onPrompt,
}: {
  disabled: boolean;
  onPrompt: (prompt: string) => void;
}) {
  return (
    <div className="m-auto w-full max-w-2xl py-2 @xl:py-12">
      <div className="mb-5 space-y-2 text-center @xl:mb-7 @xl:space-y-3">
        <div className="mx-auto mb-5 hidden size-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/8 text-primary @xl:flex">
          <Sparkles className="size-6" />
        </div>
        <p className="hidden text-[11px] font-medium tracking-[0.16em] text-muted-foreground @xl:block">
          YOUR LOGISTICS ASSISTANT
        </p>
        <h3 className="text-xl font-semibold tracking-tight @xl:text-3xl">
          What are you planning today?
        </h3>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Explore road conditions, estimate a route, or check a recorded ferry
          schedule.
        </p>
      </div>
      <div className="grid gap-3 @xl:grid-cols-3">
        {prompts.map(({ title, description, icon: Icon, prompt }) => (
          <Button
            key={title}
            variant="outline"
            disabled={disabled}
            aria-label={title}
            onClick={() => onPrompt(prompt)}
            className="relative h-auto min-w-0 justify-start gap-3 rounded-xl border p-3 pr-8 text-left whitespace-normal shadow-none @xl:flex-col @xl:items-start @xl:p-4"
          >
            <Icon className="size-5 shrink-0 text-primary" />
            <ArrowUpRight className="absolute top-4 right-4 size-3.5 text-muted-foreground" />
            <span className="space-y-1">
              <span className="block text-sm font-medium">{title}</span>
              <span className="block text-xs leading-relaxed font-normal text-muted-foreground">
                {description}
              </span>
            </span>
          </Button>
        ))}
      </div>
      <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
        Include a location, departure time, and weekday or weekend for useful
        estimates.
      </p>
    </div>
  );
}
