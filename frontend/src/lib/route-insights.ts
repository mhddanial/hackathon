import type { RouteData } from "../types/route";

export function routeInsights(data: RouteData, incomplete = false) {
  const late = !incomplete && data.departure_feasible === false;
  const feasible = !incomplete && data.departure_feasible === true;
  const status = incomplete
    ? "Incomplete recommendation"
    : late
      ? "Too late for estimated cutoff"
      : feasible
        ? "Within estimated cutoff"
        : "Cutoff check unavailable";
  const action = incomplete
    ? "Review the saved data and complete an estimate before planning dispatch."
    : late
      ? "Revise the planned departure or review a later sailing before dispatch."
      : feasible
        ? "Confirm current road conditions and terminal requirements before dispatch."
        : "This result does not include a cutoff comparison. Confirm sailing and gate-in requirements before dispatch.";
  return { late, feasible, status, action };
}
