"use client";

import { Loader2, Route, Square } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RouteEstimateDetails } from "@/components/oracle/RouteEstimateDetails";
import { batamLocations } from "@/lib/locations";
import { useRoutePlanner } from "@/hooks/use-route-planner";
import { RecordedSailingPicker } from "./RecordedSailingPicker";

function PlannerWorkspace({ account }: { account: string }) {
  const { form, result, loading, error, notice, update, calculate, cancel } =
    useRoutePlanner(account);
  return (
    <div className="min-w-0 space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Route Planner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estimate a Batam route and check a vessel cutoff with the same
          planning tools used by Oracle.
        </p>
      </header>
      {notice && (
        <Alert role="status">
          <AlertTitle>Review your planning inputs</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <Card className="gap-4 p-4 sm:p-6">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void calculate();
          }}
          className="space-y-5"
          aria-label="Route planning inputs"
        >
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {(["origin", "destination"] as const).map((key) => (
              <div key={key} className="min-w-0 space-y-2">
                <label htmlFor={key} className="text-sm font-medium capitalize">
                  {key}
                </label>
                <Input
                  id={key}
                  list="batam-locations"
                  value={form[key]}
                  onChange={(event) => update(key, event.target.value)}
                  required
                  maxLength={256}
                  autoComplete="off"
                />
              </div>
            ))}
            <datalist id="batam-locations">
              {batamLocations.map((location) => (
                <option key={location.id} value={location.name} />
              ))}
            </datalist>
            <div className="space-y-2">
              <label htmlFor="departure-date" className="text-sm font-medium">
                Departure date{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <Input
                id="departure-date"
                type="date"
                value={form.departureDate}
                onChange={(event) =>
                  update("departureDate", event.target.value)
                }
              />
              <p className="text-xs text-muted-foreground">
                Choosing a date sets its day type. Dates are needed for
                overnight planning.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="departure-time" className="text-sm font-medium">
                Road departure time · WIB
              </label>
              <Input
                id="departure-time"
                type="time"
                required
                value={form.time}
                onChange={(event) => update("time", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="day-type" className="text-sm font-medium">
                Day type
              </label>
              <Select
                value={form.dayType}
                onValueChange={(value) => {
                  if (value === "weekday" || value === "weekend")
                    update("dayType", value);
                }}
              >
                <SelectTrigger id="day-type" className="w-full">
                  <SelectValue>
                    {form.dayType === "weekday" ? "Weekday" : "Weekend"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekday">Weekday</SelectItem>
                  <SelectItem value="weekend">Weekend</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <fieldset className="min-w-0 space-y-3 rounded-xl border p-4">
            <legend className="px-1 text-sm font-medium">
              Vessel cutoff check · optional
            </legend>
            <RecordedSailingPicker
              onChoose={(etd) => update("vesselEtd", etd)}
            />
            <p className="text-xs text-muted-foreground">
              Provide both cargo and ETD, or leave both empty for travel time
              only. Times without offsets use Asia/Jakarta (UTC+07:00).
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="cargo-type" className="text-sm font-medium">
                  Cargo planning category
                </label>
                <Select
                  value={form.cargoType || "none"}
                  onValueChange={(value) => {
                    if (
                      value === "none" ||
                      value === "CONTAINER" ||
                      value === "FAST_FREIGHT"
                    )
                      update("cargoType", value === "none" ? "" : value);
                  }}
                >
                  <SelectTrigger id="cargo-type" className="w-full">
                    <SelectValue>
                      {form.cargoType === "FAST_FREIGHT"
                        ? "Fast freight · 1 hour cutoff"
                        : form.cargoType === "CONTAINER"
                          ? "Container · 2 hour cutoff"
                          : "No cutoff check"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No cutoff check</SelectItem>
                    <SelectItem value="FAST_FREIGHT">
                      Fast freight · 1 hour cutoff
                    </SelectItem>
                    <SelectItem value="CONTAINER">
                      Container · 2 hour cutoff
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="vessel-etd" className="text-sm font-medium">
                  Vessel ETD
                </label>
                <Input
                  id="vessel-etd"
                  value={form.vesselEtd}
                  maxLength={80}
                  placeholder="18:00 or 2024-01-01T12:00:00Z"
                  onChange={(event) => update("vesselEtd", event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  ISO timestamps retain their date and UTC offset.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Cargo category is a planning assumption; vessel compatibility and
              capacity are unverified.
            </p>
          </fieldset>
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Review the route request</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Route className="size-4" />
              )}
              {loading ? "Calculating route…" : "Calculate estimate"}
            </Button>
            {loading && (
              <Button type="button" variant="outline" onClick={cancel}>
                <Square className="size-3" />
                Stop
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              All planning times use Asia/Jakarta. Review the selected inputs
              before calculating.
            </p>
          </div>
        </form>
      </Card>
      <section
        aria-label="Route estimate"
        aria-live="polite"
        aria-busy={loading}
        className="@container/route min-w-0"
      >
        {result ? (
          <>
            <RouteEstimateDetails
              data={result}
              incomplete={false}
              allowHandoff={false}
              saved={false}
            />
            <p className="mt-4 text-xs text-muted-foreground">
              Calculated:{" "}
              {result.calculation_time
                ? new Date(result.calculation_time).toLocaleString("en-GB", {
                    timeZone: "Asia/Jakarta",
                  }) + " WIB"
                : "not supplied"}
              . Observation freshness is unverified. Congestion uses synthetic
              project data or an explicit default. Emissions are simplified
              estimates; no measured savings claim.
            </p>
          </>
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {loading
              ? "Estimating the route from your planning inputs…"
              : "Your route map, travel estimate, and cutoff insights will appear here."}
          </div>
        )}
      </section>
    </div>
  );
}

export function RoutePlanner() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        Loading planner…
      </p>
    );
  return (
    <PlannerWorkspace key={user?.id || "anonymous"} account={user?.id || ""} />
  );
}
