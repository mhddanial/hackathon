"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Route, Square } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RouteEstimateDetails } from "@/components/oracle/RouteEstimateDetails";
import { batamLocations } from "@/lib/locations";
import { selectRouteOption } from "@/lib/route-contract";
import { useRoutePlanner } from "@/hooks/use-route-planner";
import { RecordedSailingPicker } from "./RecordedSailingPicker";

const customCoordinatesOption = "__custom_coordinates__";

function FormLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
      {children}
    </label>
  );
}

function FormHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function FormField({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function LocationSelect({
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
  const [customCoordinatesSelected, setCustomCoordinatesSelected] = useState(
    value.includes(","),
  );
  const isSupportedLocation = batamLocations.some((location) =>
    [location.id, location.name, ...location.aliases].includes(value),
  );
  const customCoordinates =
    !isSupportedLocation && (customCoordinatesSelected || Boolean(value));

  return (
    <FormField>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <Select
        value={customCoordinates ? customCoordinatesOption : value}
        onValueChange={(val) => {
          if (!val) return;
          if (val === customCoordinatesOption) {
            setCustomCoordinatesSelected(true);
            onChange("");
            return;
          }
          setCustomCoordinatesSelected(false);
          onChange(val);
        }}
      >
        <SelectTrigger id={id} className="w-full" aria-describedby={`${id}-location-hint`}>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {batamLocations.map((location) => (
            <SelectItem key={location.id} value={location.name}>
              {location.name}
            </SelectItem>
          ))}
          <SelectItem value={customCoordinatesOption}>
            Custom coordinates
          </SelectItem>
        </SelectContent>
      </Select>
      {customCoordinates && (
        <Input
          id={`${id}-coordinates`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Latitude, longitude"
          inputMode="decimal"
          autoComplete="off"
          maxLength={80}
          required
          aria-label={`${label} coordinates`}
        />
      )}
      <FormHint>
        {customCoordinates
          ? "Enter latitude, longitude within the supported Batam planning area."
          : "Choose a supported Batam location or select Custom coordinates."}
      </FormHint>
    </FormField>
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
    if (result && window.matchMedia("(max-width: 767px)").matches) {
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
        {/* Input form */}
        <div className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Planning inputs</CardTitle>
              <CardDescription>
                All planning times use Asia/Jakarta (WIB).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void calculate();
                }}
                className="space-y-5"
                aria-label="Route planning inputs"
              >
                {/* Route fields */}
                <div className="grid min-w-0 gap-4 md:grid-cols-2">
                  <LocationSelect
                    id="origin"
                    label="Origin"
                    value={form.origin}
                    onChange={(value) => update("origin", value)}
                  />
                  <LocationSelect
                    id="destination"
                    label="Destination"
                    value={form.destination}
                    onChange={(value) => update("destination", value)}
                  />

                  {/* Departure date */}
                  <FormField>
                    <FormLabel htmlFor="departure-date">
                      Departure date{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </FormLabel>
                    <Input
                      id="departure-date"
                      type="date"
                      value={form.departureDate}
                      onChange={(event) =>
                        update("departureDate", event.target.value)
                      }
                    />
                    <FormHint>
                      Choosing a date sets its day type. Dates are needed for
                      overnight planning.
                    </FormHint>
                  </FormField>

                  {/* Departure time */}
                  <FormField>
                    <FormLabel htmlFor="departure-time">
                      Road departure time · WIB
                    </FormLabel>
                    <Input
                      id="departure-time"
                      type="time"
                      required
                      value={form.time}
                      onChange={(event) => update("time", event.target.value)}
                    />
                  </FormField>

                  {/* Day type */}
                  <FormField>
                    <FormLabel htmlFor="day-type">Day type</FormLabel>
                    <Select
                      value={form.dayType}
                      onValueChange={(val) =>
                        update("dayType", val as "weekday" | "weekend")
                      }
                    >
                      <SelectTrigger id="day-type" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekday">Weekday</SelectItem>
                        <SelectItem value="weekend">Weekend</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>

                <Separator />

                {/* Vessel cutoff section */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">
                      Vessel cutoff check{" "}
                      <Badge variant="outline" className="ml-1 align-middle">
                        optional
                      </Badge>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Provide both cargo and ETD, or leave both empty for travel
                      time only. Times without offsets use Asia/Jakarta (UTC+07:00).
                    </p>
                  </div>

                  <RecordedSailingPicker
                    onChoose={(etd) => update("vesselEtd", etd)}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Cargo type */}
                    <FormField>
                      <FormLabel htmlFor="cargo-type">
                        Cargo planning category
                      </FormLabel>
                      <Select
                        value={form.cargoType || "NO_CUTOFF"}
                        onValueChange={(val) =>
                          update(
                            "cargoType",
                            (val === "NO_CUTOFF" ? "" : val) as
                            | ""
                            | "CONTAINER"
                            | "FAST_FREIGHT",
                          )
                        }
                      >
                        <SelectTrigger id="cargo-type" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NO_CUTOFF">No cutoff check</SelectItem>
                          <SelectItem value="FAST_FREIGHT">
                            Fast freight · 1 hour cutoff
                          </SelectItem>
                          <SelectItem value="CONTAINER">
                            Container · 2 hour cutoff
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>

                    {/* Vessel ETD */}
                    <FormField>
                      <FormLabel htmlFor="vessel-etd">Vessel ETD</FormLabel>
                      <Input
                        id="vessel-etd"
                        value={form.vesselEtd}
                        maxLength={80}
                        placeholder="18:00 or 2024-01-01T12:00:00Z"
                        onChange={(event) =>
                          update("vesselEtd", event.target.value)
                        }
                      />
                      <FormHint>
                        ISO timestamps retain their date and UTC offset.
                      </FormHint>
                    </FormField>
                  </div>

                  <FormHint>
                    Cargo category is a planning assumption; vessel compatibility
                    and capacity are unverified.
                  </FormHint>
                </div>

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
                  <FormHint>
                    Review the selected inputs before calculating.
                  </FormHint>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Result panel */}
        <section
          ref={resultRef}
          aria-label="Route estimate"
          aria-live="polite"
          aria-busy={loading}
          className="@container/route min-w-0 scroll-mt-16"
        >
          {result ? (
            <>
              <p
                role="status"
                className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-700/20 bg-emerald-700/5 px-3 py-2 text-sm text-emerald-800"
              >
                <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
                Estimate ready. Review route options and planning assumptions.
              </p>

              {routeOptions.length > 0 && (
                <Card className="mb-5">
                  <CardHeader>
                    <CardTitle>Available routes</CardTitle>
                    <CardDescription>
                      {result.routing_source === "Synthetic UI fixture"
                        ? "These synthetic route options are supplied by the local UI fixture. Travel time and congestion are estimates, not verified live traffic."
                        : "These are the distinct routes returned by the routing service. Travel time and congestion are estimates, not verified live traffic."}
                      {routeOptions.length === 1
                        ? result.routing_source === "Synthetic UI fixture"
                          ? " The local fixture does not include an alternative."
                          : " The routing service did not return an alternative."
                        : " Select a route to update the map and estimate below."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <fieldset
                      className="min-w-0"
                      aria-describedby="route-comparison-note"
                    >
                      <legend className="sr-only">Available routes</legend>
                      <div className="grid min-w-0 gap-3 md:grid-cols-2">
                        {routeOptions.map((option) => {
                          const selected =
                            option.route_id === selectedRoute?.route_id;
                          return (
                            <label
                              key={option.route_id}
                              className={`block cursor-pointer rounded-xl border p-3 transition-colors ${selected
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
                                    setRouteSelection({
                                      result,
                                      routeId: option.route_id,
                                    });
                                }}
                                className="peer sr-only"
                                aria-label={`Select ${option.display_label}`}
                              />
                              <span className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold peer-focus-visible:rounded peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary">
                                {option.display_label}
                                {selected && (
                                  <Badge variant="default" className="text-xs">
                                    Selected
                                  </Badge>
                                )}
                              </span>
                              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                                <div>
                                  <dt className="text-muted-foreground">
                                    Distance
                                  </dt>
                                  <dd className="font-medium">
                                    {metric(option.distance_km)} km
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-muted-foreground">
                                    Base time
                                  </dt>
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
                                      ? `${option.congestion_level}${option.congestion_multiplier ? ` · ${metric(option.congestion_multiplier)}x` : ""}`
                                      : option.congestion_status.replaceAll(
                                        "_",
                                        " ",
                                      )}
                                  </dd>
                                </div>
                                <div className="col-span-2">
                                  <dt className="text-muted-foreground">
                                    Estimated CO2
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
                  </CardContent>
                </Card>
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
                {selectedResult?.routing_source === "Synthetic UI fixture"
                  ? "Sample fixture timestamp: "
                  : "Calculated: "}
                {selectedResult?.calculation_time
                  ? new Date(selectedResult.calculation_time).toLocaleString(
                    "en-GB",
                    { timeZone: "Asia/Jakarta" },
                  ) + " WIB"
                  : "not supplied"}
                {selectedResult?.routing_source === "Synthetic UI fixture"
                  ? selectedResult.calculation_time
                    ? ". Sample timestamp follows the requested departure date; no live routing request was made."
                    : ". No departure date was supplied, so the fixture did not provide a timestamp; no live routing request was made."
                  : ". Observation freshness is unverified. Congestion uses synthetic project data or an explicit default. Emissions are simplified estimates; no measured savings claim."}
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {loading ? (
                <p role="status">
                  Estimating the route from your planning inputs...
                </p>
              ) : (
                "Your route map, travel estimate, and cutoff insights will appear here."
              )}
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
        Loading planner...
      </p>
    );
  return (
    <PlannerWorkspace key={user?.id || "anonymous"} account={user?.id || ""} />
  );
}
