import { parseRoute, parseRouteInput } from "./route-contract";
import type { RouteInput } from "../types/route";

export async function estimateRoute(input: RouteInput, signal: AbortSignal) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080"}/route`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parseRouteInput(input)),
      signal,
    },
  );
  if (!response.ok) {
    let detail: unknown;
    try {
      detail = (await response.json()).detail;
    } catch {
      /* Use a safe status message. */
    }
    if (response.status === 400 || response.status === 422) {
      throw new Error(
        typeof detail === "string" && detail.length < 1000
          ? detail
          : "Check the locations, date, time, cargo and vessel ETD.",
      );
    }
    throw new Error("Route data is temporarily unavailable. Please try again.");
  }
  return parseRoute(await response.json());
}
