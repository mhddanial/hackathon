"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Route, Square } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { RouteEstimateDetails } from "@/components/oracle/RouteEstimateDetails";
import { batamLocations } from "@/lib/locations";
import { selectRouteOption } from "@/lib/route-contract";
import { useRoutePlanner } from "@/hooks/use-route-planner";
import { RecordedSailingPicker } from "./RecordedSailingPicker";

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

function LocationAutocomplete({
  id,
  label,
  value,
  onChange,
}: {
  id: "origin" | "destination";
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const query = value.trim().toLocaleLowerCase();
  const options = batamLocations
    .filter((location) =>
      !query ||
      [location.name, location.id, ...location.aliases].some((candidate) =>
        candidate.toLocaleLowerCase().includes(query),
      ),
    )
    .slice(0, 8);
  const listId = `${id}-location-options`;
  const choose = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  return (
    <div className="relative z-20 min-w-0 space-y-2">
      <label htmlFor={id} className="text-sm font-medium capitalize">
        {label}
      </label>
      <Input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          open && activeIndex >= 0 && options[activeIndex]
            ? `${id}-location-option-${options[activeIndex].id}`
            : undefined
        }
        aria-describedby={`${id}-location-hint`}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          // Let a pointer selection fire before dismissing the list.
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && options.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => Math.min(index + 1, options.length - 1));
          } else if (event.key === "ArrowUp" && options.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) =>
              index < 0 ? options.length - 1 : Math.max(index - 1, 0),
            );
          } else if (
            event.key === "Enter" &&
            open &&
            options[activeIndex]
          ) {
            event.preventDefault();
            choose(options[activeIndex].name);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
          }
        }}
        required
        maxLength={256}
        autoComplete="off"
      />
      <p id={`${id}-location-hint`} className="text-xs text-muted-foreground">
        Search supported Batam locations or enter latitude, longitude.
      </p>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {options.length ? (
            options.map((location, index) => (
              <button
                id={`${id}-location-option-${location.id}`}
                key={location.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/70"}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(location.name)}
              >
                {location.name}
              </button>
            ))
          ) : (
            <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
              No matching locations. You can enter coordinates as latitude,
              longitude.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PlannerWorkspace({ account }: { account: string }) {
  const { form, result, loading, error, notice, update, calculate, cancel } =
    useRoutePlanner(account);
  const [routeSelection, setRouteSelection] = useState<{
    result: NonNullable<typeof result>;
    routeId: string;
  }>();
  const routeOptions = result?.route_options || [];
  const selectedRouteId =
    routeSelection?.result === result ? routeSelection.routeId : undefined;
  const selectedRoute =
    routeOptions.find((option) => option.route_id === selectedRouteId) ||
    routeOptions.find((option) => option.route_id === result?.default_route_id);
  const selectedResult = result
    ? selectRouteOption(result, selectedRoute?.route_id)
    : null;
  const resultRef = useRef<HTMLElement | null>(null);
  const metric = (value: number) =>
    new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
  useEffect(() => {
    if (
      result &&
      window.matchMedia("(max-width: 767px)").matches
    ) {
      resultRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }
  }, [result]);
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
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(18rem,0.84fr)_minmax(0,1.16fr)]">
        <div className="min-w-0">
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
                <LocationAutocomplete
                  id="origin"
                  label="Origin"
                  value={form.origin}
                  onChange={(value) => update("origin", value)}
                />
                <LocationAutocomplete
                  id="destination"
                  label="Destination"
                  value={form.destination}
                  onChange={(value) => update("destination", value)}
                />
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
                  <select
                    id="day-type"
                    value={form.dayType}
                    onChange={(event) =>
                      update("dayType", event.target.value as "weekday" | "weekend")
                    }
                    className={selectClassName}
                  >
                    <option value="weekday">Weekday</option>
                    <option value="weekend">Weekend</option>
                  </select>
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
                    <select
                      id="cargo-type"
                      value={form.cargoType}
                      onChange={(event) =>
                        update(
                          "cargoType",
                          event.target.value as "" | "CONTAINER" | "FAST_FREIGHT",
                        )
                      }
                      className={selectClassName}
                    >
                      <option value="">No cutoff check</option>
                      <option value="FAST_FREIGHT">
                        Fast freight · 1 hour cutoff
                      </option>
                      <option value="CONTAINER">Container · 2 hour cutoff</option>
                    </select>
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
        </div>
        <section
          ref={resultRef}
          aria-label="Route estimate"
          aria-live="polite"
          aria-busy={loading}
          className="@container/route min-w-0 scroll-mt-16"
        >
          {result ? (
            <>
              <p role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-700/20 bg-emerald-700/5 px-3 py-2 text-sm text-emerald-800">
                <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
                Estimate ready. Review route options and planning assumptions.
              </p>
              {routeOptions.length > 0 && (
                <fieldset
                  className="mb-5 min-w-0 space-y-3 rounded-xl border p-4"
                  aria-describedby="route-comparison-note"
                >
                  <legend className="px-1 text-sm font-semibold">
                    Available routes
                  </legend>
                  <p
                    id="route-comparison-note"
                    className="text-xs leading-relaxed text-muted-foreground"
                  >
                    These are the distinct routes returned by the routing
                    service. Travel time and congestion are estimates, not
                    verified live traffic.
                    {routeOptions.length === 1
                      ? " The routing service did not return an alternative."
                      : " Select a route to update the map and estimate below."}
                  </p>
                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    {routeOptions.map((option) => {
                      const selected = option.route_id === selectedRoute?.route_id;
                      return (
                        <label
                          key={option.route_id}
                          className={`block cursor-pointer rounded-lg border p-3 transition-colors ${
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/40"
                          }`}
                        >
                          <input
                            type="radio"
                            name="planner-route-option"
                            value={option.route_id}
                            checked={selected}
                            onChange={() => {
                              if (result)
                                setRouteSelection({ result, routeId: option.route_id });
                            }}
                            className="peer sr-only"
                            aria-label={`Select ${option.display_label}`}
                          />
                          <span className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold peer-focus-visible:rounded peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary">
                            {option.display_label}
                            {selected && (
                              <span className="text-xs font-medium text-primary">
                                Selected
                              </span>
                            )}
                          </span>
                          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                            <div>
                              <dt className="text-muted-foreground">Distance</dt>
                              <dd className="font-medium">
                                {metric(option.distance_km)} km
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Base time</dt>
                              <dd className="font-medium">
                                {metric(option.base_time_min)} min
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">
                                Adjusted estimate
                              </dt>
                              <dd className="font-medium">
                                {metric(option.final_time_min)} min
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">
                                Congestion estimate
                              </dt>
                              <dd className="font-medium">
                                {option.congestion_level
                                  ? `${option.congestion_level}${option.congestion_multiplier ? ` · ${metric(option.congestion_multiplier)}×` : ""}`
                                  : option.congestion_status.replaceAll("_", " ")}
                              </dd>
                            </div>
                            <div className="col-span-2">
                              <dt className="text-muted-foreground">
                                Estimated CO₂
                              </dt>
                              <dd className="font-medium">
                                {metric(option.emission_kg)} kg · simulation
                              </dd>
                            </div>
                          </dl>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              <RouteEstimateDetails
                data={selectedResult || result}
                incomplete={false}
                allowHandoff={false}
                saved={false}
                selectedRouteId={selectedRoute?.route_id}
                routeOptions={routeOptions}
                emissionFormulaProvenance="current"
              />
              <p className="mt-4 text-xs text-muted-foreground">
                Calculated:{" "}
                {selectedResult?.calculation_time
                  ? new Date(selectedResult.calculation_time).toLocaleString("en-GB", {
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
                ? <p role="status">Estimating the route from your planning inputs…</p>
                : "Your route map, travel estimate, and cutoff insights will appear here."}
            </div>
          )}
        </section>
      </div>
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
