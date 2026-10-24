import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = await readFile(
  new URL("../src/components/oracle/RouteEstimateDetails.tsx", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
const Wrapper = ({ children, ...props }) =>
  React.createElement("div", props, children);
const Icon = () => null;
const dependencies = {
  "react/jsx-runtime": await import("react/jsx-runtime"),
  "lucide-react": {
    AlertTriangle: Icon,
    ChevronDown: Icon,
    CheckCircle2: Icon,
    Clock3: Icon,
    Gauge: Icon,
    Info: Icon,
    Leaf: Icon,
    MapPin: Icon,
    Route: Icon,
    Ship: Icon,
  },
  "./RoutePlannerHandoff": { RoutePlannerHandoff: () => null },
  "@/lib/route-insights": {
    routeInsights: () => ({
      late: false,
      feasible: false,
      status: "Unavailable",
      action: "No cutoff check.",
    }),
  },
  "@/components/MapView": { default: () => null },
  "@/components/ui/alert": {
    Alert: Wrapper,
    AlertTitle: Wrapper,
    AlertDescription: Wrapper,
  },
  "@/components/ui/badge": { Badge: Wrapper },
  "@/components/ui/card": { Card: Wrapper },
  "@/lib/oracle-format": {
    formatOracleDate: (value) => value,
    formatOracleNumber: (value) => String(value),
  },
  "@/lib/road-segments": { roadName: () => undefined },
};
const exports = {};
new Function("require", "exports", code)((name) => {
  assert.ok(name in dependencies, `Unexpected import: ${name}`);
  return dependencies[name];
}, exports);

const RouteEstimateDetails = exports.RouteEstimateDetails;
const current = {
  distance_km: 5,
  final_time_min: 15,
  base_time_min: 10,
  routing_source: "OSRM API",
  emission_kg: 1.5,
  congestion_multiplier: 1.5,
  matched_segment_id: "SEG001",
  congestion_status: "synthetic_estimate",
};
const render = (
  data,
  emissionFormulaProvenance = "unknown",
  saved = true,
) =>
  renderToStaticMarkup(
    React.createElement(RouteEstimateDetails, {
      data,
      incomplete: false,
      allowHandoff: false,
      saved,
      emissionFormulaProvenance,
    }),
  );
const formula =
  "distance × 0.2 kg CO₂/km × congestion multiplier";
const currentMarkup = render(current, "current");
assert.ok(currentMarkup.includes("1.5 kg"));
assert.ok(currentMarkup.includes("Simulation only, not a measurement"));
assert.ok(currentMarkup.includes(`Current estimator formula: ${formula}.`));
assert.ok(currentMarkup.includes("approximate light-truck assumption"));
assert.ok(!currentMarkup.includes("Formula version for this result is unknown"));
assert.ok(currentMarkup.includes("one reference corridor"));
assert.ok(currentMarkup.includes("5 min above the base travel estimate."));
assert.ok(
  render(current, "current", true).includes(
    `Current estimator formula: ${formula}.`,
  ),
);

const historicalMarkup = render(current);
assert.ok(historicalMarkup.includes("Formula version for this result is unknown"));
assert.ok(historicalMarkup.includes("not confirmed as the formula that produced this value"));
assert.ok(historicalMarkup.includes(`The current estimator uses ${formula}`));
assert.ok(historicalMarkup.includes("approximate light-truck factor that is not"));
assert.ok(historicalMarkup.includes("universal across vehicles"));
assert.ok(
  render(current, "unknown", false).includes(
    "Formula version for this result is unknown",
  ),
);

const partialMarkup = render({ ...current, congestion_multiplier: undefined });
assert.ok(partialMarkup.includes("1.5 kg"));
assert.ok(partialMarkup.includes("Formula version for this result is unknown"));
assert.ok(partialMarkup.includes("insufficient to identify the calculation"));
assert.ok(!partialMarkup.includes("The current estimator uses"));

const missingEmissionMarkup = render({
  distance_km: 5,
  final_time_min: 15,
  routing_source: "historical",
});
assert.ok(!missingEmissionMarkup.includes("Emission estimate"));
assert.ok(!missingEmissionMarkup.includes("Formula version for this result"));

const missingDistanceMarkup = render({
  ...current,
  distance_km: undefined,
});
assert.ok(missingDistanceMarkup.includes("1.5 kg"));
assert.ok(missingDistanceMarkup.includes("insufficient to identify the calculation"));
assert.ok(!missingDistanceMarkup.includes("The current estimator uses"));

const originFallbackMarkup = render({
  ...current,
  planning_warning:
    "Route geometry matching found no segment; the congestion reference falls back to a corridor near the origin and may not represent the route traveled.",
});
assert.ok(originFallbackMarkup.includes("one reference corridor"));
assert.ok(
  originFallbackMarkup.includes(
    "falls back to a corridor near the origin and may not represent the route traveled.",
  ),
);

const unavailableMarkup = render({
  ...current,
  congestion_status: "unavailable",
  congestion_multiplier: undefined,
  matched_segment_id: undefined,
});
assert.ok(unavailableMarkup.includes("No congestion reference is available for this estimate."));
assert.ok(!unavailableMarkup.includes("one reference corridor"));
assert.ok(!unavailableMarkup.includes("5 min above the base travel estimate."));
assert.ok(unavailableMarkup.includes("5 km"));
assert.ok(unavailableMarkup.includes("15 min"));
assert.ok(unavailableMarkup.includes("10 min"));

console.log(
  "PASS formula provenance and current/historical/partial/matched/fallback/unavailable route details",
);
