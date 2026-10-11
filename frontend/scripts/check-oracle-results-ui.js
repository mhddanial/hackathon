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
    await page.getByText("SEG001 · HIGH · 1.6× travel time", { exact: true }).waitFor();
    await page.getByText("2 recorded departures", { exact: true }).waitFor(); await page.getByText("2.5 km · 0 min", { exact: true }).waitFor();
  });
  await check("congestion dialog includes provenance, limitations and timezone timestamps", async () => {
    const d = await open("Corridor estimate");
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
    await d.getByText("Clock times come from this result. A service date and source time zone were not provided.", { exact: true }).waitFor(); await close();
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
