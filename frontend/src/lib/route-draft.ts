import { parseRouteInput } from "./route-contract";
import type { RouteData, RouteInput } from "../types/route";

const prefix = "smartflow:route-draft:";
const accountKey = "smartflow:route-draft-account";
const ttl = 30 * 60 * 1000;
const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function clearRouteDrafts(storage: Storage) {
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) storage.removeItem(key);
  }
}

export function syncDraftAccount(account: string | null, storage: Storage) {
  if (!account || storage.getItem(accountKey) !== account)
    clearRouteDrafts(storage);
  if (account) storage.setItem(accountKey, account);
  else storage.removeItem(accountKey);
}

export function routeInputFromResult(data: RouteData): RouteInput {
  return parseRouteInput({
    origin: data.origin,
    destination: data.destination,
    origin_name: data.origin_name,
    destination_name: data.destination_name,
    time: data.departure_time,
    day_type: data.day_type,
    departure_date: data.departure_date,
    vessel_etd: data.vessel_etd,
    cargo_type: data.cargo_type,
  });
}

export function saveRouteDraft(
  input: RouteInput,
  account: string,
  storage: Storage,
  now = Date.now(),
) {
  syncDraftAccount(account, storage);
  // Keep storage bounded, including drafts left by previous visits.
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys.slice(0, Math.max(0, keys.length - 9)))
    storage.removeItem(key);
  const id = crypto.randomUUID();
  storage.setItem(
    prefix + id,
    JSON.stringify({
      version: 1,
      account,
      createdAt: now,
      input: parseRouteInput(input),
    }),
  );
  return id;
}

export function loadRouteDraft(
  id: string,
  account: string,
  storage: Storage,
  now = Date.now(),
): RouteInput {
  if (!idPattern.test(id))
    throw new Error("This Planner draft link is invalid.");
  const raw = storage.getItem(prefix + id);
  if (!raw || raw.length > 8000)
    throw new Error(
      "This draft is unavailable in this tab. Open it again from Oracle.",
    );
  try {
    const value = JSON.parse(raw);
    if (
      value.version !== 1 ||
      value.account !== account ||
      !Number.isFinite(value.createdAt) ||
      value.createdAt > now ||
      now - value.createdAt >= ttl
    )
      throw new Error();
    return parseRouteInput(value.input);
  } catch {
    // Reads are repeatable (including React Strict Mode hydration). Account
    // cleanup and bounded writes remove obsolete entries; invalid reads never
    // turn an expired draft into a misleading "missing draft" on the next read.
    throw new Error(
      "This Planner draft is invalid or expired. Open it again from Oracle.",
    );
  }
}
