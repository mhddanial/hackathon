"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { createDepartureApi, DepartureApiError } from "@/lib/departure-api";
import { departureInput, DepartureValidationError, initialDepartureForm, roadTimeFromEstimate } from "@/lib/departure-form";
import type { DepartureFormValues } from "@/lib/departure-form";
import type { DepartureResult } from "@/types/departure";

export function useDepartureRecommendation(account: string) {
  const [form, setForm] = useState(initialDepartureForm);
  const [result, setResult] = useState<DepartureResult | null>(null);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const active = useRef<AbortController | null>(null), generation = useRef(0);
  const cancel = useCallback(() => { generation.current++; active.current?.abort(); active.current = null; setLoading(false); }, []);
  useEffect(() => () => { generation.current++; active.current?.abort(); }, [account]);
  const clear = () => { cancel(); setResult(null); setError(""); setFields({}); setNotice(""); };
  const update = (key: keyof DepartureFormValues, value: string) => {
    clear();
    setForm(old => {
      const next = { ...old, [key]: value };
      // Visible initial default only. Later road-date edits never silently move the sailing date.
      if (key === "departure_date" && !old.service_date) next.service_date = value;
      return next;
    });
  };
  const calculate = async (target?: string) => {
    clear();
    const submitted = target === undefined ? form : { ...form, schedule_id: target };
    if (target !== undefined) setForm(submitted);
    let input;
    try { input = departureInput(submitted); }
    catch (e) {
      if (e instanceof DepartureValidationError) { setFields(e.errors); setError(e.message); document.getElementById(`dep-${Object.keys(e.errors)[0]}`)?.focus(); }
      return;
    }
    const controller = new AbortController(), own = generation.current;
    active.current = controller; setLoading(true);
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 25000);
    try {
      const api = createDepartureApi(account, createClient().auth);
      const data = await api.calculate(input, controller.signal);
      if (own === generation.current && !controller.signal.aborted) setResult(data);
    } catch (e) {
      if (own !== generation.current || (controller.signal.aborted && !timedOut)) return;
      setError(timedOut ? "The planning request timed out. Please retry." : e instanceof Error ? e.message : "The planning service is temporarily unavailable. Please retry.");
      if (e instanceof DepartureApiError) {
        if (e.status === 401) { setExpired(true); setForm(initialDepartureForm); }
        else if (e.fields.length) {
          const affected = new Set(e.fields.map(field => field === "origin_name" ? "origin" : field === "day_type" ? "departure_date" : field));
          const ordered = Object.keys(initialDepartureForm).filter(field => affected.has(field));
          const errors = Object.fromEntries(ordered.map(field => [field, "Review this field: " + e.message]));
          setFields(errors);
          if (ordered[0]) document.getElementById(`dep-${ordered[0]}`)?.focus();
        }
      }
    } finally {
      window.clearTimeout(timer);
      if (own === generation.current) { active.current = null; setLoading(false); }
    }
  };
  const useRoadTime = (value: string) => { clear(); setForm(old => ({ ...old, ...roadTimeFromEstimate(value) })); setNotice("Road date and time copied from a fixed-duration estimate. Review the sailing date and recalculate for this traffic period."); document.getElementById("dep-departure_date")?.focus(); };
  return { form, result, error, fields, expired, loading, notice, update, calculate, useRoadTime, stop: () => { clear(); setNotice("Calculation stopped. Review the plan and calculate again."); }, revise: () => { clear(); document.getElementById("dep-origin")?.focus(); } };
}
