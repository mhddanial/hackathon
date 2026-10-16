"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Info, Route, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RouteEstimateDetails } from "@/components/oracle/RouteEstimateDetails";
import {
  formatOracleDate as date,
  formatOracleNumber as format,
} from "@/lib/oracle-format";
import { cn } from "@/lib/utils";
import { resultStatusLabels } from "@/lib/oracle-results";
import { roadName } from "@/lib/road-segments";
import type {
  DisplayMessage,
  OracleResult,
  ScheduleEntry,
} from "@/types/oracle";

function Facts({
  values,
}: {
  values: [string, string | number | undefined][];
}) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {values
        .filter(([, value]) => value !== undefined)
        .map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words font-medium">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

function ScheduleDetails({ schedules }: { schedules: ScheduleEntry[] }) {
  if (!schedules.length)
    return (
      <p>
        No departures were returned by this source. Availability has not been
        confirmed.
      </p>
    );
  const cutoff = schedules.some((row) => row.cutoff_time !== undefined);
  const vessel = schedules.some((row) => row.vessel_type !== undefined);
  const capacity = schedules.some(
    (row) => row.cargo_capacity_tons !== undefined,
  );
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Recorded departures; service dates and the source time zone were not
        provided.
      </p>
      <div className="max-w-full overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Recorded ferry schedules</caption>
          <thead className="bg-muted">
            <tr>
              {[
                "Terminal",
                "Destination",
                "Departure",
                ...(cutoff ? ["Cutoff"] : []),
                ...(vessel ? ["Vessel"] : []),
                ...(capacity ? ["Capacity (tons)"] : []),
              ].map((label) => (
                <th key={label} scope="col" className="p-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedules.map((row, index) => (
              <tr key={index} className="border-t">
                <td className="p-3 break-words">{row.terminal}</td>
                <td className="p-3 break-words">{row.destination}</td>
                <td className="p-3 whitespace-nowrap">{row.departure_time}</td>
                {cutoff && (
                  <td className="p-3 whitespace-nowrap">
                    {row.cutoff_time ?? "Not provided"}
                  </td>
                )}
                {vessel && (
                  <td className="p-3 break-words">
                    {row.vessel_type ?? "Not provided"}
                  </td>
                )}
                {capacity && (
                  <td className="p-3">
                    {row.cargo_capacity_tons !== undefined
                      ? format(row.cargo_capacity_tons)
                      : "Not provided"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultDetails({
  result,
  incomplete,
}: {
  result: OracleResult;
  incomplete: boolean;
}) {
  if (result.type === "congestion") {
    const data = result.data;
    return (
      <Facts
        values={[
          ["Road corridor", roadName(data.segment_id, data.segment_name)],
          ["Day type", data.day_type],
          ["Hour bucket", `${data.hour}:00`],
          ["Congestion level", data.congestion_level],
          ["Time multiplier", `${format(data.multiplier)}×`],
        ]}
      />
    );
  }
  if (result.type === "schedule")
    return <ScheduleDetails schedules={result.data.schedules} />;
  if (result.type === "route")
    return <RouteEstimateDetails data={result.data} incomplete={incomplete} />;
  return (
    <pre className="max-w-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs">
      {JSON.stringify(result.data, null, 2)}
    </pre>
  );
}

function Preview({ result }: { result: OracleResult }) {
  if (result.type === "congestion")
    return (
      <p>
        {roadName(result.data.segment_id, result.data.segment_name)} ·{" "}
        {result.data.congestion_level} · {format(result.data.multiplier)}×
        travel time
      </p>
    );
  if (result.type === "schedule")
    return (
      <p>
        {result.data.schedules.length} recorded departure
        {result.data.schedules.length === 1 ? "" : "s"}
      </p>
    );
  if (result.type === "route")
    return (
      <p>
        {format(result.data.distance_km)} km ·{" "}
        {format(result.data.final_time_min)} min
      </p>
    );
  return <p>Additional structured data</p>;
}

function ResultModal({
  result,
  incomplete,
}: {
  result: OracleResult;
  incomplete: boolean;
}) {
  const route = result.type === "route";
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
      <Dialog.Popup
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border text-foreground shadow-xl",
          route
            ? "@container/route max-w-7xl bg-card sm:w-[calc(100%-3rem)]"
            : "max-w-3xl bg-background",
        )}
      >
        <div className="shrink-0 border-b p-4 pr-16 sm:p-6 sm:pr-16">
          <div className="flex items-start gap-3">
            {route && (
              <div
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary"
              >
                <Route className="size-5" />
              </div>
            )}
            <div className="min-w-0">
              <Dialog.Title
                className={cn(
                  "break-words font-semibold tracking-tight",
                  route ? "text-xl sm:text-2xl" : "text-lg",
                )}
              >
                {result.title}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Saved {result.type} result ·{" "}
                {resultStatusLabels[result.data_status]}
              </Dialog.Description>
            </div>
          </div>
          <Dialog.Close
            render={
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                aria-label="Close result details"
              />
            }
          >
            <X aria-hidden="true" />
          </Dialog.Close>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 text-sm sm:p-6">
          {incomplete && (
            <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
              This turn failed or was interrupted. These saved tool results are
              not a complete recommendation.
            </p>
          )}
          <ResultDetails result={result} incomplete={incomplete} />
          <section
            aria-label="Source and limitations"
            className={cn(
              "mt-5 space-y-2",
              route
                ? "rounded-xl border bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground"
                : "border-t pt-4",
            )}
          >
            {route && (
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Info
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                About this estimate
              </h3>
            )}
            <p className="break-words">
              <strong>Source:</strong> {result.source}
            </p>
            <p>
              <strong>Data status:</strong>{" "}
              {resultStatusLabels[result.data_status]}
            </p>
            {result.observed_at ? (
              <p>
                <strong>Observed:</strong> {date(result.observed_at)}
              </p>
            ) : (
              <p>Observation time not provided; freshness unverified.</p>
            )}
            {result.calculated_at && (
              <p>
                <strong>Calculated:</strong> {date(result.calculated_at)}
              </p>
            )}
            <p className="break-words whitespace-pre-wrap">
              <strong>Limitations:</strong> {result.disclaimer}
            </p>
          </section>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t p-3 sm:px-6">
          {route ? (
            <p className="text-xs text-muted-foreground">
              Estimate only. Confirm terminal and sailing requirements.
            </p>
          ) : (
            <span />
          )}
          <Dialog.Close
            render={
              <Button
                variant="outline"
                className="shrink-0 rounded-lg font-medium"
              />
            }
          >
            Close details
          </Dialog.Close>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  );
}

export function OracleResults({
  results = [],
  unavailable = 0,
  outcome,
}: {
  results?: OracleResult[];
  unavailable?: number;
  outcome: DisplayMessage["outcome"];
}) {
  const saved =
    outcome === "completed" ||
    outcome === "failed" ||
    outcome === "interrupted";
  if (!results.length && !unavailable) return null;
  return (
    <div className="mt-3 min-w-0 space-y-3 whitespace-normal">
      {results.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {results.length} result record{results.length === 1 ? "" : "s"}
        </p>
      )}
      {unavailable > 0 && (
        <p className="text-xs text-muted-foreground">
          {unavailable} result{unavailable === 1 ? " is" : "s are"} unavailable
          because the data could not be validated.
        </p>
      )}
      {!saved && results.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Result details will be available when the saved outcome is confirmed.
        </p>
      )}
      {saved &&
        results.map((result, index) => (
          <Dialog.Root key={index}>
            <article
              aria-label={`${result.title} result`}
              className="min-w-0 space-y-2 rounded-lg border bg-background p-3 text-sm text-foreground"
            >
              <h3 className="break-words font-medium">{result.title}</h3>
              <p className="text-xs text-muted-foreground">
                {resultStatusLabels[result.data_status]}
              </p>
              <Preview result={result} />
              <p className="break-words text-xs text-muted-foreground">
                Source: {result.source}
              </p>
              <Dialog.Trigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`View details: ${result.title}`}
                  />
                }
              >
                View details
              </Dialog.Trigger>
            </article>
            <ResultModal result={result} incomplete={outcome !== "completed"} />
          </Dialog.Root>
        ))}
    </div>
  );
}
