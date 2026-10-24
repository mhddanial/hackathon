"use client";

import { useEffect, useState } from "react";

type Sailing = { id: string; label: string; etd: string };

export function RecordedSailingPicker({
  onChoose,
}: {
  onChoose: (etd: string) => void;
}) {
  const [rows, setRows] = useState<Sailing[]>([]);
  const [status, setStatus] = useState("Loading recorded sailings…");
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus("Sailings timed out. Enter the vessel ETD manually.");
      controller.abort();
    }, 10000);
    void (async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080"}/schedules`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!Array.isArray(data.schedules)) throw new Error();
        const valid: Sailing[] = [];
        for (const row of data.schedules.slice(0, 100)) {
          if (
            !row ||
            !["string", "number"].includes(typeof row.id) ||
            typeof row.departure_time !== "string" ||
            !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(row.departure_time) ||
            typeof row.destination !== "string" ||
            typeof row.terminal_name !== "string"
          )
            continue;
          valid.push({
            id: String(row.id),
            label: `${row.departure_time.slice(0, 5)} · ${row.terminal_name.slice(0, 100)} to ${row.destination.slice(0, 100)}`,
            etd: row.departure_time.slice(0, 5),
          });
        }
        if (!controller.signal.aborted) {
          setRows(valid);
          setStatus(
            valid.length
              ? "Recorded project times; freshness and source timezone are unverified. Verify before using as a WIB planning time."
              : "No recorded sailings available. Enter the vessel ETD manually.",
          );
        }
      } catch {
        if (!controller.signal.aborted)
          setStatus("Sailings are unavailable. Enter the vessel ETD manually.");
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className="space-y-2">
      <label htmlFor="recorded-sailing" className="text-sm font-medium">
        Copy a recorded sailing time
      </label>
      <select
        id="recorded-sailing"
        value={selectedId}
        disabled={!rows.length}
        onChange={(event) => {
          const value = event.target.value;
          const row = rows.find((row) => row.id === value);
          setSelectedId(value);
          if (row) onChoose(row.etd);
        }}
        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">
          {rows.length ? "Choose a recorded sailing (optional)" : status}
        </option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
      </select>
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {status} This copies only the clock time. Confirm the route terminal and select cargo separately.
      </p>
    </div>
  );
}
