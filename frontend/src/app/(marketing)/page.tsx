import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Leaf, Map, MessageSquare, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const workspaces = [
  {
    title: "Route Planner",
    description:
      "Compare route options when available, review estimated distance and travel time, and check vessel cutoff planning.",
    href: "/planner",
    action: "Open planner",
    icon: Map,
  },
  {
    title: "Ferry Schedules",
    description:
      "Browse schedule records by terminal and inspect departure times, cutoffs, destinations, and listed capacity.",
    href: "/schedules",
    action: "View schedules",
    icon: Ship,
  },
  {
    title: "Logistics Oracle",
    description:
      "Open logistics conversations and review structured results returned by the Oracle workspace.",
    href: "/oracle",
    action: "Open Oracle",
    icon: MessageSquare,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="SmartFlow home">
            <Image src="/logo-icon.png" alt="" width={36} height={36} className="size-9 object-contain" />
            <span className="text-lg font-semibold tracking-tight text-primary">SmartFlow</span>
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-5 text-sm font-medium text-muted-foreground md:flex">
            <Link href="/planner" className="transition-colors hover:text-foreground">Route Planner</Link>
            <Link href="/schedules" className="transition-colors hover:text-foreground">Ferry Schedules</Link>
            <Link href="/oracle" className="transition-colors hover:text-foreground">Logistics Oracle</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Create account</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-semibold tracking-wide text-primary">
              Batam route planning and ferry schedules
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Plan a route. Understand the estimate.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              SmartFlow brings route planning, recorded ferry schedules, and logistics conversations into one workspace. Review the source and assumptions behind estimates before making an operational decision.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/planner">
                  Open route planner <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/schedules">Browse ferry schedules</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Route, congestion, cutoff, and emissions values are estimates. Check their source and limitations in the app.
            </p>
          </div>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardDescription>Planning workflow</CardDescription>
              <CardTitle className="text-xl">From inputs to a reviewable estimate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                ["1", "Choose locations and planning details"],
                ["2", "Review the route options returned by the routing service"],
                ["3", "Compare travel estimates and cutoff assumptions"],
              ].map(([number, text]) => (
                <div key={number} className="flex items-start gap-3 rounded-lg border bg-background p-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {number}
                  </span>
                  <p className="pt-1 text-sm leading-5">{text}</p>
                </div>
              ))}
              <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">
                Alternative routes depend on what the routing service returns. A single-route fallback remains available.
              </p>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="workspaces-title" className="border-y bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <div className="mb-8 max-w-2xl">
              <h2 id="workspaces-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Explore the SmartFlow workspaces
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Start with the task you need to complete.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {workspaces.map(({ title, description, href, action, icon: Icon }) => (
                <Card key={title} className="flex h-full flex-col">
                  <CardHeader>
                    <span className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <CardTitle className="text-lg">{title}</CardTitle>
                    <CardDescription className="leading-6">{description}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Button asChild variant="outline" size="sm">
                      <Link href={href}>
                        {action} <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="estimate-notes-title" className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-8 lg:py-16">
          <div>
            <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Leaf aria-hidden="true" className="size-5" />
            </div>
            <h2 id="estimate-notes-title" className="text-2xl font-semibold tracking-tight">
              Know what each estimate represents
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              SmartFlow shows the assumptions and provenance available with each route result.
            </p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <dt className="text-sm font-semibold">Congestion</dt>
              <dd className="mt-2 text-sm leading-6 text-muted-foreground">
                Uses synthetic project estimates or an explicit default. It does not represent live traffic across the route.
              </dd>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <dt className="text-sm font-semibold">CO₂</dt>
              <dd className="mt-2 text-sm leading-6 text-muted-foreground">
                A simplified simulation based on route distance and an assumed vehicle factor, not a measured emission value.
              </dd>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <dt className="text-sm font-semibold">Ferry schedule records</dt>
              <dd className="mt-2 text-sm leading-6 text-muted-foreground">
                Source freshness and timezone may be unverified. Confirm departure details with the appropriate operator.
              </dd>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <dt className="text-sm font-semibold">Vessel cutoff planning</dt>
              <dd className="mt-2 text-sm leading-6 text-muted-foreground">
                Depends on the selected cargo category and supplied ETD; vessel compatibility and capacity are unverified.
              </dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span className="font-medium text-foreground">SmartFlow</span>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/planner" className="hover:text-foreground">Route Planner</Link>
            <Link href="/schedules" className="hover:text-foreground">Ferry Schedules</Link>
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
