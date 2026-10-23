import {
  parseRoute,
  parseRouteAlternatives,
  parseRouteInput,
} from "./route-contract";
import type { RouteInput } from "../types/route";

class AlternativesEndpointUnavailable extends Error {}

async function requestRoute(
  path: string,
  input: RouteInput,
  signal: AbortSignal,
) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080"}${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parseRouteInput(input)),
      signal,
    },
  );
  if (!response.ok) {
    if (
      path === "/route/alternatives" &&
      (response.status === 404 || response.status === 405)
    )
      throw new AlternativesEndpointUnavailable();
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
  return response.json() as Promise<unknown>;
}

export async function estimateRoute(input: RouteInput, signal: AbortSignal) {
  return parseRoute(await requestRoute("/route", input, signal));
}

export async function estimateRouteAlternatives(
  input: RouteInput,
  signal: AbortSignal,
) {
  try {
    return parseRouteAlternatives(
      await requestRoute("/route/alternatives", input, signal),
    );
  } catch (error) {
    if (!(error instanceof AlternativesEndpointUnavailable)) throw error;
    return {
      ...parseRoute(await requestRoute("/route", input, signal)),
      route_options: [],
    };
  }
}
