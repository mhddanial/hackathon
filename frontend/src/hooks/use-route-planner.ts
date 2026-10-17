"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { batamLocations } from "@/lib/locations";
import { parseRouteInput } from "@/lib/route-contract";
import { estimateRoute } from "@/lib/route-api";
import { loadRouteDraft } from "@/lib/route-draft";
import type { RouteData, RouteInput } from "@/types/route";

export type PlannerForm = {
  origin: string;
  destination: string;
  time: string;
  dayType: "weekday" | "weekend";
  departureDate: string;
  vesselEtd: string;
  cargoType: "" | "CONTAINER" | "FAST_FREIGHT";
};
const defaults: PlannerForm = {
  origin: "Batamindo Industrial Park",
  destination: "Batu Ampar Port",
  time: "10:00",
  dayType: "weekday",
  departureDate: "",
  vesselEtd: "",
  cargoType: "",
};
const normalize = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function resolvePlannerLocation(value: string) {
  if (value.includes(",")) {
    const parts = value.split(",");
    if (parts.length !== 2 || parts.some((p) => !p.trim()))
      throw new Error("Use latitude, longitude for coordinates.");
    if (parts.some((part) => !Number.isFinite(Number(part))))
      throw new Error("Coordinates require finite latitude and longitude numbers.");
    return { lat: Number(parts[0]), lng: Number(parts[1]), name: value.trim() };
  }
  const key = normalize(value);
  const matches = batamLocations.filter((row) =>
    [row.id, row.name, ...row.aliases].some(
      (label) => normalize(label) === key,
    ),
  );
  if (matches.length !== 1)
    throw new Error(
      `Choose a specific supported location for “${value}”, or supply coordinates within Batam.`,
    );
  return matches[0];
}

export function plannerInput(form: PlannerForm): RouteInput {
  const origin = resolvePlannerLocation(form.origin),
    destination = resolvePlannerLocation(form.destination);
  return parseRouteInput({
    origin: { lat: origin.lat, lng: origin.lng },
    destination: { lat: destination.lat, lng: destination.lng },
    origin_name: origin.name,
    destination_name: destination.name,
    time: form.time,
    day_type: form.dayType,
    departure_date: form.departureDate || undefined,
    vessel_etd: form.vesselEtd.trim() || undefined,
    cargo_type: form.cargoType || undefined,
  });
}

function formFromInput(input: RouteInput): PlannerForm {
  // Coordinates are authoritative; a display label from an old result may not be in the catalog.
  const label = (point: RouteInput["origin"]) => {
    const row = batamLocations.find(
      (row) => row.lat === point.lat && row.lng === point.lng,
    );
    return row?.name || `${point.lat}, ${point.lng}`;
  };
  return {
    origin: label(input.origin),
    destination: label(input.destination),
    time: input.time,
    dayType: input.day_type,
    departureDate: input.departure_date || "",
    vesselEtd: input.vessel_etd || "",
    cargoType: input.cargo_type || "",
  };
}

export function useRoutePlanner(account: string | null) {
  const [form, setForm] = useState<PlannerForm>(defaults);
  const [result, setResult] = useState<RouteData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);

  const cancel = useCallback(() => {
    generation.current++;
    active.current?.abort();
    active.current = null;
    setLoading(false);
  }, []);

  useEffect(() => {
    const hydrate = () => {
      const draft = new URL(window.location.href).searchParams.get("draft");
      if (!draft) return;
      if (!account) { setError("Sign in to restore this Planner draft."); return; }
      cancel();
      setResult(null);
      setNotice("");
      try {
        setForm(
          formFromInput(loadRouteDraft(draft, account, window.sessionStorage)),
        );
        setNotice(
          "Inputs copied from an Oracle estimate. Review them, then calculate a fresh estimate.",
        );
        setError("");
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Draft storage is unavailable in this browser.",
        );
      }
    };
    hydrate();
    window.addEventListener("popstate", hydrate);
    return () => {
      cancel();
      window.removeEventListener("popstate", hydrate);
    };
  }, [account, cancel]);

  const update = <K extends keyof PlannerForm>(
    key: K,
    value: PlannerForm[K],
  ) => {
    cancel();
    setResult(null);
    setError("");
    setForm((old) => {
      const next = { ...old, [key]: value };
      if (key === "cargoType" && value === "") next.vesselEtd = "";
      if (key === "departureDate" && value) {
        const day = new Date(`${value}T00:00:00Z`).getUTCDay();
        if (Number.isFinite(day))
          next.dayType = day === 0 || day === 6 ? "weekend" : "weekday";
      }
      return next;
    });
  };

  const calculate = async () => {
    cancel();
    const own = generation.current;
    setResult(null);
    setError("");
    const controller = new AbortController();
    active.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 25000);
    try {
      const input = plannerInput(form);
      setLoading(true);
      const data = await estimateRoute(input, controller.signal);
      if (own === generation.current) setResult(data);
    } catch (error) {
      if (
        own === generation.current &&
        (!controller.signal.aborted || timedOut)
      )
        setError(
          timedOut
            ? "The route request timed out. Please try again."
            : error instanceof Error
              ? error.message
              : "Could not calculate the route.",
        );
    } finally {
      window.clearTimeout(timer);
      if (own === generation.current) {
        active.current = null;
        setLoading(false);
      }
    }
  };
  return { form, result, loading, error, notice, update, calculate, cancel };
}
