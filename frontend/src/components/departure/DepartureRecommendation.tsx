"use client";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDepartureRecommendation } from "@/hooks/use-departure-recommendation";
import { DepartureForm } from "./DepartureForm";
import { DepartureResult } from "./DepartureResult";
function Workspace({ account }: { account: string }) {
  const state = useDepartureRecommendation(account);
  return <div className="min-w-0 space-y-5 pb-6">
    <header><h1 className="text-2xl font-semibold tracking-tight">Departure Recommendation</h1><p className="mt-1 text-sm text-muted-foreground">Plan a road departure against a recorded ferry cutoff. Road departure, terminal arrival and ferry departure are distinct times.</p></header>
    <div className="rounded-xl border bg-muted/40 p-4 text-sm"><p className="font-medium">Planning simulation · source limitations</p><p className="mt-1 text-muted-foreground">Congestion uses synthetic project estimates and representative terminal points. Recorded sailings need verified dates, source zones, service permission and freshness. This is no boarding guarantee.</p></div>
    <Card className="gap-4 p-4 sm:p-6"><DepartureForm form={state.form} fields={state.fields} loading={state.loading} expired={state.expired} account={account} update={state.update} calculate={() => void state.calculate()} stop={state.stop} /></Card>
    {state.error && <div role="alert" className="space-y-3 rounded-xl border border-destructive p-4 text-sm"><p>{state.error}</p>{state.expired ? <Link href="/login" className="inline-flex min-h-11 items-center underline">Sign in again</Link> : !Object.keys(state.fields).length && <Button className="min-h-11" variant="outline" onClick={() => void state.calculate()}>Retry recommendation</Button>}</div>}
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{state.loading ? "Calculating…" : state.notice || (state.result ? `${state.result.status}: ${state.result.reason}` : "")}</p>
    {state.result ? <DepartureResult result={state.result} onUseRoadTime={state.useRoadTime} choose={id => void state.calculate(id)} revise={state.revise} /> : <div aria-busy={state.loading} className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{state.loading ? "Calculating… Use Stop to cancel." : state.expired ? "Sign in to calculate a new plan." : "Enter a road plan to calculate an estimate."}</div>}
  </div>;
}
export function DepartureRecommendation() {
  const { user, session, loading } = useAuth();
  if (loading) return <p role="status">Loading departure planning…</p>;
  if (!user || !session) return <div role="status"><p>Sign in to plan a departure.</p><Link className="inline-flex min-h-11 items-center underline" href="/login">Sign in</Link></div>;
  // An identity change unmounts all form/results, requests and catalog state.
  return <Workspace key={user.id} account={user.id} />;
}
