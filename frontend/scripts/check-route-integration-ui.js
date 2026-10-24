// playwright-cli run-code --filename; synthetic Auth/API on 9010 and Next on 3010.
async (page) => {
  const origin = "http://127.0.0.1:3010", fixture = "http://127.0.0.1:9010";
  const checks = [];
  let draftUrl;
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const control = async data => { const r = await page.request.post(`${fixture}/__control`, { data }); assert(r.ok(), "control"); };
  const stats = async () => (await page.request.get(`${fixture}/__stats`)).json();
  const routes = async () => (await stats()).requests.filter(row => row.path === "/route/alternatives");
  const check = async (name, run) => { try { await run(); checks.push(name); } catch (e) { throw new Error(`After ${checks.length} checks, ${name}: ${e.message}`); } };
  const ready = () => page.getByRole("button", { name: "Calculate estimate", exact: true }).waitFor();
  const calculate = async () => { await page.getByRole("button", { name: "Calculate estimate", exact: true }).click(); await page.getByRole("region", { name: "Route planning summary" }).waitFor(); };
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${origin}/planner`); await ready();

  await check("route-only estimate submits validated catalog coordinates and no vessel defaults", async () => {
    await calculate(); const sent = (await routes()).at(-1).body;
    assert(sent.time === "10:00" && sent.day_type === "weekday" && sent.origin.lat > 0, "planning inputs");
    assert(!sent.vessel_etd && !sent.cargo_type, "invented vessel planning");
    assert(await page.getByRole("region", { name: "Route map", exact: true }).count() === 1, "map missing");
    await page.getByText(/Simulation only, not a measurement of actual CO₂ emissions\./).waitFor();
    await page.getByText(/Current estimator formula: distance × 0\.2 kg CO₂\/km × congestion multiplier\./).waitFor();
    await page.getByText(/approximate light-truck assumption, not a universal value for all vehicles\./).waitFor();
    const secondRoute = page.getByRole("radio", { name: "Select Route 2" });
    await secondRoute.check();
    assert(await secondRoute.isChecked(), "selected route state did not update");
    const summary = page.getByRole("region", { name: "Route planning summary" });
    await summary.getByText("14 min", { exact: true }).waitFor();
    await summary.getByText("7 km", { exact: true }).waitFor();
  });
  await check("single returned option is real and does not fabricate an alternative", async () => {
    await control({ singleRoute: true });
    await calculate();
    assert(await page.getByRole("radio", { name: "Select Route 1" }).count() === 1, "single route option missing");
    assert(await page.getByRole("radio", { name: "Select Route 2" }).count() === 0, "an alternative was fabricated");
    await page.getByText("The local fixture does not include an alternative.", { exact: false }).waitFor();
    await control({ singleRoute: false });
  });
  await check("unknown location is actionable and never reaches routing", async () => {
    const count = (await routes()).length; await page.locator("#origin").fill("My unknown warehouse");
    await page.getByRole("button", { name: "Calculate estimate", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Choose a specific supported location" }).waitFor();
    assert((await routes()).length === count, "unknown location routed"); await page.locator("#origin").fill("Batamindo");
  });
  await check("date derives weekend and conflicting user day is rejected", async () => {
    await page.locator("#departure-date").fill("2024-01-06");
    await calculate(); assert((await routes()).at(-1).body.day_type === "weekend", "day not derived");
    await page.locator("#day-type").click(); await page.getByRole("option", { name: "Weekday", exact: true }).click();
    const count = (await routes()).length;
    await page.getByRole("button", { name: "Calculate estimate", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "conflicts with day type" }).waitFor();
    assert((await routes()).length === count, "conflict routed"); await page.locator("#departure-date").fill("2024-01-01");
  });
  await check("ETD without cargo is rejected, ISO offset survives complete cutoff planning", async () => {
    await page.locator("#vessel-etd").fill("2024-01-01T12:00:00Z");
    await page.getByRole("button", { name: "Calculate estimate", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Provide both cargo" }).waitFor();
    await page.locator("#cargo-type").click(); await page.getByRole("option", { name: "Fast freight · 1 hour cutoff", exact: true }).click();
    await calculate(); const sent = (await routes()).at(-1).body;
    assert(sent.vessel_etd === "2024-01-01T12:00:00Z" && sent.cargo_type === "FAST_FREIGHT", "ISO/cargo lost");
    await page.getByText("Cutoff slack", { exact: true }).waitFor(); await page.getByText("Estimated arrival", { exact: true }).waitFor();
    await page.locator("#cargo-type").click(); await page.getByRole("option", { name: "No cutoff check", exact: true }).click();
    assert(await page.locator("#vessel-etd").inputValue() === "", "removing cutoff planning retained ETD");
  });
  await check("failed request clears loading without retaining successful results", async () => {
    await control({ routeFailure: true }); await page.locator("#departure-time").fill("11:00");
    await page.getByRole("button", { name: "Calculate estimate", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "temporarily unavailable" }).waitFor(); await ready();
    assert(await page.getByRole("region", { name: "Route planning summary" }).count() === 0, "stale recommendation");
    await control({ routeFailure: false });
  });
  await check("editing during an in-flight request prevents stale result replacement", async () => {
    await control({ routeDelay: 1000 }); await page.getByRole("button", { name: "Calculate estimate", exact: true }).click();
    await page.getByRole("button", { name: "Stop", exact: true }).waitFor(); await page.locator("#departure-time").fill("12:00");
    await page.waitForTimeout(1200);
    assert(await page.getByRole("region", { name: "Route planning summary" }).count() === 0, "late result applied"); await ready();
    await control({ routeDelay: 0 });
  });
  const result = { type: "route", title: "Route estimate", source: "synthetic_ui_fixture", data_status: "estimated", disclaimer: "Synthetic fixture, not operational.",
    data: { distance_km: 5, final_time_min: 15, routing_source: "OSRM API", emission_kg: 1.5, congestion_multiplier: 1.5, origin: { lat: 1.06048, lng: 104.030321 }, destination: { lat: 1.162951, lng: 104.002488 },
      origin_name: "Batamindo Industrial Park", destination_name: "Batu Ampar Port", departure_time: "10:00", departure_date: "2024-01-01", day_type: "weekday",
      cargo_type: "FAST_FREIGHT", vessel_etd: "2024-01-01T19:00:00+07:00", planning_timezone: "Asia/Jakarta", estimated_arrival_time: "10:15", cutoff_slack_min: 0,
      route_geometry: { type: "LineString", coordinates: [[104.030321,1.06048],[104.002488,1.162951]] } } };
  const conversation = "00000000-0000-4000-8000-000000000102";
  await check("Oracle handoff preserves inputs and waits for explicit recalculation", async () => {
    await control({ savedResults: { conversationId: conversation, results: [result], status: "completed" } });
    await page.goto(`${origin}/oracle?conversation=${conversation}`);
    await page.getByRole("button", { name: "View details: Route estimate", exact: true }).click();
    await page.getByText(/Simulation only, not a measurement of actual CO₂ emissions\./).waitFor();
    await page.getByText(/Current estimator formula: distance × 0\.2 kg CO₂\/km × congestion multiplier\./).waitFor();
    await page.getByText(/approximate light-truck assumption, not a universal value for all vehicles\./).waitFor();
    const before = (await routes()).length;
    await page.getByRole("button", { name: "Edit in Route Planner", exact: true }).click(); await ready();
    assert(new URL(page.url()).searchParams.has("draft"), "missing opaque draft ID");
    draftUrl = page.url();
    assert(await page.locator("#vessel-etd").inputValue() === result.data.vessel_etd, "ETD changed");
    assert(await page.locator("#departure-date").inputValue() === "2024-01-01", "date lost");
    assert((await routes()).length === before, "handoff auto-executed");
  });
  await check("draft survives reload and editing does not overwrite saved Oracle data", async () => {
    await page.reload(); await ready(); assert(await page.locator("#vessel-etd").inputValue() === result.data.vessel_etd, "draft not restored");
    await page.locator("#departure-time").fill("11:00"); await calculate();
    assert((await routes()).at(-1).body.time === "11:00", "edited time not sent");
    // Original result is checked through reopening the UI under the existing Auth session.
    await page.goto(`${origin}/oracle?conversation=${conversation}`); await page.getByRole("button", { name: "View details: Route estimate", exact: true }).click();
    await page.getByRole("dialog").getByText(/10:00/).first().waitFor();
  });
  await check("incomplete historical results do not offer an actionable handoff", async () => {
    await control({ savedResults: { conversationId: conversation, results: [result], status: "failed" } });
    await page.goto(`${origin}/oracle?conversation=${conversation}`); await page.getByRole("button", { name: "View details: Route estimate", exact: true }).click();
    assert(await page.getByRole("button", { name: "Edit in Route Planner", exact: true }).isDisabled(), "incomplete handoff enabled");
  });
  await check("malformed draft has a visible correction path without routing", async () => {
    const count = (await routes()).length; await page.goto(`${origin}/planner?draft=invalid`); await ready();
    await page.getByRole("alert").filter({ hasText: "draft link is invalid" }).waitFor(); assert((await routes()).length === count, "invalid draft executed");
  });
  await check("mobile form and result fit the viewport", async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`${origin}/planner`); await ready(); await calculate();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "mobile horizontal overflow");
    await page.locator(".leaflet-overlay-pane path").waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "output/playwright/planner-integration-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1100 }); await page.screenshot({ path: "output/playwright/planner-integration-desktop.png", fullPage: true });
  });
  await check("expired draft is rejected without issuing a route request", async () => {
    const id = new URL(draftUrl).searchParams.get("draft");
    await page.evaluate(id => {
      const key = `smartflow:route-draft:${id}`;
      const value = JSON.parse(sessionStorage.getItem(key));
      value.createdAt = Date.now() - 30 * 60 * 1000 - 1;
      sessionStorage.setItem(key, JSON.stringify(value));
    }, id);
    const count = (await routes()).length; await page.goto(draftUrl); await ready();
    await page.getByRole("alert").filter({ hasText: "invalid or expired" }).waitFor();
    assert((await routes()).length === count, "expired draft executed");
  });
  const login = async email => {
    await page.goto(`${origin}/login`); await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
    await page.getByRole("button", { name: "Sign In", exact: true }).click(); await page.waitForURL("**/dashboard");
  };
  await check("logout clears handoff drafts and another account cannot load them", async () => {
    await control({ savedResults: { conversationId: conversation, results: [result], status: "completed" } });
    await page.goto(`${origin}/oracle?conversation=${conversation}`);
    await page.getByRole("button", { name: "View details: Route estimate", exact: true }).click();
    await page.getByRole("button", { name: "Edit in Route Planner", exact: true }).click(); await ready();
    const accountDraftUrl = page.url();
    assert(await page.evaluate(() => Object.keys(sessionStorage).some(key => key.startsWith("smartflow:route-draft:"))), "no draft created");
    await page.getByRole("button", { name: "Open account menu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Sign out", exact: true }).click(); await page.waitForURL(`${origin}/login`);
    assert(await page.evaluate(() => !Object.keys(sessionStorage).some(key => key.startsWith("smartflow:route-draft:"))), "draft survived logout");
    await login("b@sprint4.example.invalid"); await page.goto(accountDraftUrl); await ready();
    await page.getByRole("alert").filter({ hasText: "unavailable in this tab" }).waitFor();
    assert(await page.locator("#vessel-etd").inputValue() === "", "prior account vessel inputs leaked");
    await page.getByRole("button", { name: "Open account menu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Sign out", exact: true }).click(); await page.waitForURL(`${origin}/login`);
    await login("a@sprint4.example.invalid"); await page.goto(`${origin}/oracle`);
  });
  await control({ uiChecks: checks, routeFailure: false, routeDelay: 0 });
  return { checks_passed: checks.length, checks, scope: "Chromium + real Next UI, synthetic Auth/API; no live Gemini or production persistence" };
}
