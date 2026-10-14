// Run with playwright-cli run-code --filename against the loopback synthetic fixture.
async (page) => {
  const origin = "http://127.0.0.1:3010", fixture = "http://127.0.0.1:9010";
  const checks = [], id = "00000000-0000-4000-8000-000000000102";
  const meta = { source: "synthetic_ui_fixture", data_status: "estimated", disclaimer: "Synthetic fixture; do not use for real planning." };
  const congestion = { ...meta, title: "Corridor estimate", type: "congestion", data_status: "synthetic_estimate", observed_at: "2026-10-10T01:00:00Z", calculated_at: "2026-10-10T01:01:00Z", data: { segment_id: "SEG001", day_type: "weekday", hour: 8, congestion_level: "HIGH", multiplier: 1.6 } };
  const schedule = { ...meta, title: "Recorded sailings", type: "schedule", data_status: "database", data: { schedules: [{ terminal: "Harbour A", destination: "Island B", departure_time: "09:00", cutoff_time: "08:30", vessel_type: "Cargo", cargo_capacity_tons: 0 }, { terminal: "Harbour A", destination: "Island C", departure_time: "12:00" }] } };
  const route = { ...meta, title: "Route estimate", type: "route", data: { distance_km: 2.5, final_time_min: 0, routing_source: "fixture_route" } };
  const generic = { ...meta, title: "Extra details", type: "generic", data_status: "unknown", data: { note: '<img src=x onerror="window.oracleResultInjected=true">', nested: [0, null, true] } };
  const control = async data => { const r = await page.request.post(`${fixture}/__control`, { data }); if (!r.ok()) throw new Error("Fixture control failed"); };
  const stats = async () => (await page.request.get(`${fixture}/__stats`)).json();
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const ready = async () => { await page.getByRole("textbox", { name: "Message Oracle" }).waitFor(); await page.waitForFunction(() => !document.querySelector('input[aria-label="Message Oracle"]').disabled); };
  const saved = async (results, status = "completed") => {
    await control({ savedResults: { conversationId: id, results, status } });
    await page.goto(`${origin}/oracle?conversation=${id}`); await page.getByText("Saved answer: Road question", { exact: false }).waitFor();
  };
  const trigger = title => page.getByRole("button", { name: `View details: ${title}`, exact: true });
  const open = async title => { await trigger(title).click(); await page.getByRole("dialog", { name: title, exact: true }).waitFor(); return page.getByRole("dialog", { name: title, exact: true }); };
  const close = async () => { await page.getByRole("button", { name: "Close details", exact: true }).click(); await page.getByRole("dialog").waitFor({ state: "hidden" }); };
  const check = async (name, fn) => { try { await fn(); checks.push(name); } catch (error) { throw new Error(`After ${checks.length} passes, failed ${name}: ${error.message}`); } };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await check("four independent saved cards show actual previews and source/status", async () => {
    await saved([congestion, schedule, route, generic]); await trigger("Extra details").waitFor();
    assert(await page.getByRole("button", { name: /^View details:/ }).count() === 4, "Missing multiple result cards");
    await page.getByText("Jl. Yos Sudarso (Koridor Utama) · HIGH · 1.6× travel time", { exact: true }).waitFor();
    await page.getByText("2 recorded departures", { exact: true }).waitFor(); await page.getByText("2.5 km · 0 min", { exact: true }).waitFor();
  });
  await check("congestion dialog includes provenance, limitations and timezone timestamps", async () => {
    const d = await open("Corridor estimate");
    await d.getByText("Jl. Yos Sudarso (Koridor Utama)", { exact: true }).waitFor();
    await d.getByText("10 Oct 2026, 08:00 WIB", { exact: false }).waitFor(); await d.getByText("10 Oct 2026, 08:01 WIB", { exact: false }).waitFor();
    await d.getByText(meta.disclaimer, { exact: false }).waitFor(); await d.getByText("Time multiplier", { exact: true }).waitFor();
    await page.screenshot({ path: "output/playwright/oracle-sprint5-desktop.png", fullPage: true }); await close();
  });
  await check("keyboard opens dialog, traps focus, Escape closes and returns focus", async () => {
    await trigger("Route estimate").focus(); await page.keyboard.press("Enter"); await page.getByRole("dialog").waitFor();
    await page.waitForFunction(() => !!document.activeElement?.closest('[role="dialog"]'));
    for (let n = 0; n < 5; n++) { await page.keyboard.press("Tab"); await page.waitForFunction(() => !!document.activeElement?.closest('[role="dialog"]')); }
    await page.keyboard.press("Shift+Tab"); await page.waitForFunction(() => !!document.activeElement?.closest('[role="dialog"]'));
    await page.keyboard.press("Escape"); await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert(await trigger("Route estimate").evaluate(node => node === document.activeElement), "Focus did not return to trigger");
  });
  await check("route omits missing emission/departure fields and marks unverified freshness", async () => {
    const d = await open("Route estimate"); await d.getByText("0 min", { exact: true }).waitFor();
    assert(!(await d.getByText("Emission estimate", { exact: true }).count()), "Invented emission");
    assert(!(await d.getByText("Suggested departure", { exact: true }).count()), "Invented departure");
    await d.getByText("Observation time not provided; freshness unverified.", { exact: true }).waitFor(); await close();
  });
  await check("schedule preserves zero capacity and clearly marks partial optional fields", async () => {
    const d = await open("Recorded sailings"); await d.getByRole("columnheader", { name: "Capacity (tons)", exact: true }).waitFor();
    assert(await d.getByRole("cell", { name: "0", exact: true }).count() === 1, "Zero capacity lost");
    assert(await d.getByRole("cell", { name: "Not provided", exact: true }).count() === 3, "Missing data fabricated"); await close();
  });
  await check("provided route optional fields retain zeroes and source clock limitations", async () => {
    await saved([{ ...route, data: { ...route.data, emission_kg: 0, base_time_min: 0, congestion_level: "LOW", congestion_multiplier: 1, matched_segment_id: "SEG001", latest_gate_in: "09:00", optimal_departure: "08:30" } }]);
    const d = await open("Route estimate"); await d.getByText("0 kg", { exact: true }).waitFor(); await d.getByText("08:30", { exact: true }).waitFor();
    await d.getByText("Jl. Yos Sudarso (Koridor Utama)", { exact: true }).waitFor();
    await d.getByText("Clock times come from this result. A service date and source time zone were not provided.", { exact: true }).waitFor(); await close();
    await saved([congestion, schedule, route, generic]);
  });
  await check("stored response names override catalog labels in preview and details", async () => {
    await saved([{ ...congestion, data: { ...congestion.data, segment_name: "Updated Yos Sudarso corridor" } },
      { ...route, data: { ...route.data, matched_segment_id: "SEG002", matched_segment_name: "Updated Sudirman corridor" } }]);
    await page.getByText("Updated Yos Sudarso corridor · HIGH · 1.6× travel time", { exact: true }).waitFor();
    let d = await open("Corridor estimate"); await d.getByText("Updated Yos Sudarso corridor", { exact: true }).waitFor(); await close();
    d = await open("Route estimate"); await d.getByText("Updated Sudirman corridor", { exact: true }).waitFor(); await close();
    await saved([congestion, schedule, route, generic]);
  });
  const mappedRoute = { ...route, data: { ...route.data, routing_source: "OSRM API", final_time_min: 30,
    origin: { lat: 1.0604795, lng: 104.0303214 }, destination: { lat: 1.1629505, lng: 104.0024883 },
    origin_name: "Batamindo Industrial Park", destination_name: "Batu Ampar Port",
    route_geometry: { type: "LineString", coordinates: [[104.030321,1.06048],[104.028,1.09],[104.015,1.13],[104.002488,1.162951]] },
    departure_time: "10:00", departure_date: "2024-01-01", departure_datetime: "2024-01-01T10:00:00+07:00",
    planning_timezone: "Asia/Jakarta", day_type: "weekday", cargo_type: "FAST_FREIGHT", vessel_etd: "2024-01-01T19:00:00+07:00",
    latest_gate_in: "18:00", latest_gate_in_datetime: "2024-01-01T18:00:00+07:00",
    optimal_departure: "17:30", optimal_departure_datetime: "2024-01-01T17:30:00+07:00", departure_feasible: true,
    congestion_status: "unavailable", planning_warning: "Corridor congestion unavailable; travel time assumes a 1.0 multiplier." } };
  await check("saved route map renders named markers and actual polyline with dated planning details", async () => {
    await saved([mappedRoute]); const d = await open("Route estimate");
    const map = d.getByRole("region", { name: "Saved route map" }); await map.locator(".leaflet-container").waitFor();
    await map.locator(".leaflet-overlay-pane path").waitFor();
    assert(await map.locator(".leaflet-marker-icon").count() === 2, "Missing route endpoints");
    assert(await map.locator(".leaflet-overlay-pane path").count() === 1, "Unexpected mock routes");
    await d.getByText("1 Jan 2024, 19:00 WIB", { exact: true }).waitFor();
    await d.getByText("FAST FREIGHT", { exact: true }).waitFor();
    await d.getByText("Within estimated cutoff", { exact: true }).waitFor();
    await map.getByRole("link", { name: "OpenStreetMap", exact: true }).waitFor();
    await page.waitForFunction(() => { const tiles = [...document.querySelectorAll('[role="dialog"] .leaflet-tile')]; return tiles.length > 0 && tiles.every(tile => tile.complete && tile.naturalWidth > 0 && Number(getComputedStyle(tile).opacity) >= 0.99); });
    await page.screenshot({ path: "output/playwright/oracle-route-map-desktop.png", fullPage: true }); await close();
  });
  await check("mobile mapped result fits dialog and survives refresh without rerouting", async () => {
    await page.setViewportSize({ width: 390, height: 844 }); let d = await open("Route estimate");
    await d.locator(".leaflet-overlay-pane path").waitFor();
    const box = await d.boundingBox(); assert(box.x >= 0 && box.x + box.width <= 391, "Map escapes mobile dialog");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Map causes horizontal overflow");
    await page.waitForFunction(() => { const map = document.querySelector('[role="dialog"] .leaflet-container'); const box = map?.getBoundingClientRect(); return box && [...map.querySelectorAll('.leaflet-marker-icon')].every(marker => { const r=marker.getBoundingClientRect(); return r.top>=box.top && r.bottom<=box.bottom && r.left>=box.left && r.right<=box.right; }); });
    await page.screenshot({ path: "output/playwright/oracle-route-map-mobile.png", fullPage: true }); await close();
    await ready(); const before = await stats(); await page.reload(); await ready(); d = await open("Route estimate");
    await d.locator(".leaflet-overlay-pane path").waitFor(); assert((await stats()).executions === before.executions, "Map refresh rerouted");
    await close(); await page.setViewportSize({ width: 1440, height: 1000 });
  });
  await check("approximate and missing saved geometry never show mock road routes", async () => {
    await saved([{ ...mappedRoute, data: { ...mappedRoute.data, routing_source: "Haversine Fallback" } }]); let d = await open("Route estimate");
    await d.getByText("Approximate straight-line connection; road routing was unavailable.", { exact: false }).waitFor();
    const path = d.locator(".leaflet-overlay-pane path"); await path.waitFor(); assert(await path.getAttribute("stroke-dasharray"), "Approximation is not dashed"); await close();
    await saved([route]); d = await open("Route estimate"); await d.getByText("Map unavailable for this saved result.", { exact: true }).waitFor();
    assert(!(await d.locator(".leaflet-container").count()), "Legacy result invented a map"); await close();
    await saved([congestion, schedule, route, generic]);
  });
  await check("generic and metadata HTML render as text without creating elements", async () => {
    const d = await open("Extra details"); await d.getByText(/oracleResultInjected/).waitFor();
    assert(await page.evaluate(() => !window.oracleResultInjected && !document.querySelector('[role="dialog"] img')), "Result HTML executed"); await close();
    const hostile = '<img src=x onerror="window.oracleResultInjected=true">';
    await saved([{ ...generic, title: hostile, source: hostile, disclaimer: hostile }]); await open(hostile);
    assert(await page.evaluate(() => !window.oracleResultInjected && !document.querySelector('[role="dialog"] img') && !document.querySelector('[aria-label="Conversation messages"] img')), "Metadata HTML executed"); await close();
  });
  await check("unsupported/malformed results are isolated without hiding saved answer", async () => {
    await saved([route, { ...route, type: "departure" }, { ...schedule, data: { schedules: [{}] } }]); await trigger("Route estimate").waitFor();
    assert(await page.getByRole("button", { name: /^View details:/ }).count() === 1, "Invalid result opened details");
    await page.getByText("2 results are unavailable because the data could not be validated.", { exact: true }).waitFor();
  });
  await check("empty schedule and assumed default have explicit limitations", async () => {
    await saved([{ ...schedule, data: { schedules: [] }, data_status: "default_fallback" }]); await page.getByText("0 recorded departures", { exact: true }).waitFor();
    const d = await open("Recorded sailings"); await d.getByText("No departures were returned by this source. Availability has not been confirmed.", { exact: true }).waitFor();
    await d.getByText("Data status: Assumed default", { exact: false }).waitFor(); await close();
  });
  await check("failed and interrupted saved results are marked incomplete", async () => {
    for (const status of ["failed", "interrupted"]) {
      await saved([route], status); const d = await open("Route estimate");
      await d.getByText("This turn failed or was interrupted. These saved tool results are not a complete recommendation.", { exact: true }).waitFor(); await close();
    }
  });
  await check("refresh restores same data and inspection makes no API/tool request", async () => {
    await saved([route]); await ready(); const before = await stats();
    await open("Route estimate"); await close(); await open("Route estimate"); await close();
    const after = await stats(); assert(after.executions === before.executions && after.requests.length === before.requests.length, "Inspection fetched or executed a tool");
    await page.reload(); await ready(); const d = await open("Route estimate"); await d.getByText("2.5 km", { exact: true }).waitFor(); await close();
    assert((await stats()).executions === before.executions, "Refresh executed provider/tool");
  });
  await check("conversation navigation removes open dialog; foreign chat exposes no cards", async () => {
    await open("Route estimate"); await page.goto(`${origin}/oracle`); await ready();
    assert(!(await page.getByRole("dialog").count()), "Previous dialog survived new conversation");
    assert(!(await page.getByRole("button", { name: /^View details:/ }).count()), "Previous cards leaked to new conversation");
    await page.goto(`${origin}/oracle?conversation=00000000-0000-4000-8000-000000000201`); await page.getByText(/Conversation unavailable\./).waitFor();
    assert(!(await page.getByRole("dialog").count()) && !(await page.getByRole("button", { name: /^View details:/ }).count()), "Foreign conversation exposed result");
  });
  await check("mobile long schedule scrolls within a bounded dialog; backdrop closes", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ ...schedule.data.schedules[0], destination: `Long destination ${i} with a descriptive terminal name` }));
    await saved([{ ...schedule, data: { schedules: rows } }]); await page.setViewportSize({ width: 390, height: 844 }); const d = await open("Recorded sailings");
    const box = await d.boundingBox(); assert(box.x >= 0 && box.x + box.width <= 391 && box.y >= 0 && box.y + box.height <= 845, "Dialog escapes mobile viewport");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Mobile page overflow");
    assert(await d.evaluate(node => [...node.querySelectorAll('div')].some(el => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === "auto")), "Long content has no scroll area");
    await page.screenshot({ path: "output/playwright/oracle-sprint5-mobile.png", fullPage: true });
    await page.mouse.click(2, 2); await page.getByRole("dialog").waitFor({ state: "hidden" }); await page.setViewportSize({ width: 1440, height: 1000 });
  });
  await check("no result opens no modal", async () => { await saved([]); await ready(); assert(!(await page.getByRole("button", { name: /^View details:/ }).count()), "Empty results produced modal trigger"); });
  await check("unconfirmed stream results cannot open a recommendation dialog", async () => {
    await page.getByRole("button", { name: "New conversation", exact: true }).click(); await ready();
    await control({ mode: "save-failure", nextResults: [route] }); await page.getByRole("textbox", { name: "Message Oracle" }).fill("Sprint 5 uncertain result"); await page.getByRole("button", { name: "Send message", exact: true }).click();
    await page.getByText("Result details will be available when the saved outcome is confirmed.", { exact: true }).waitFor();
    assert(!(await page.getByRole("button", { name: /^View details:/ }).count()), "Unconfirmed result exposed recommendation");
    await control({ finishActive: "interrupted" }); await page.getByRole("button", { name: "Retry this turn", exact: true }).click(); await ready();
  });
  await check("streamed valid multiple results become inspectable after persistence", async () => {
    await control({ nextResults: [congestion, route] }); await page.getByRole("textbox", { name: "Message Oracle" }).fill("Sprint 5 multiple results"); await page.getByRole("button", { name: "Send message", exact: true }).click();
    await ready(); await trigger("Corridor estimate").waitFor(); await trigger("Route estimate").waitFor(); await open("Route estimate"); await close();
  });
  return { checks_passed: checks.length, checks, scope: "Real Chromium/Next UI with local synthetic Auth/API; no signed-in Supabase/provider", screenshot_directory: "output/playwright" };
}
