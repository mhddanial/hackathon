// Run with playwright-cli run-code --filename against oracle-ui-fixture.mjs.
async (page) => {
  const origin = new URL(page.url()).origin;
  const fixture = "http://127.0.0.1:9010";
  const id = "00000000-0000-4000-8000-000000000102";
  const checks = [];
  const result = {
    type: "route", title: "Route estimate", source: "synthetic_ui_fixture", data_status: "estimated",
    disclaimer: "Synthetic UI fixture; not for operational use.", calculated_at: "2026-10-16T07:00:00Z",
    data: {
      distance_km: 42.5, final_time_min: 75, base_time_min: 45, routing_source: "OSRM API",
      origin: { lat: 1.0604795, lng: 104.0303214 }, destination: { lat: 1.1629505, lng: 104.0024883 },
      origin_name: "Batamindo Industrial Park", destination_name: "Batu Ampar Port",
      route_geometry: { type: "LineString", coordinates: [[104.030321,1.06048],[104.028,1.09],[104.015,1.13],[104.002488,1.162951]] },
      planning_timezone: "Asia/Jakarta", day_type: "weekday", cargo_type: "FAST_FREIGHT",
      departure_datetime: "2026-10-16T15:00:00+07:00", optimal_departure_datetime: "2026-10-16T15:45:00+07:00",
      latest_gate_in_datetime: "2026-10-16T17:00:00+07:00", vessel_etd: "2026-10-16T19:00:00+07:00",
      departure_feasible: true, emission_kg: 8.4, congestion_level: "HIGH", congestion_multiplier: 1.667,
      matched_segment_id: "SEG001", congestion_status: "synthetic_estimate",
      planning_warning: "Travel time uses a synthetic corridor estimate; confirm current traffic before dispatch.",
    },
  };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const stats = async () => (await page.request.get(`${fixture}/__stats`)).json();
  const dialog = page.getByRole("dialog", { name: "Route estimate", exact: true });
  const open = async (data = result.data, status = "completed") => {
    const response = await page.request.post(`${fixture}/__control`, { data: { savedResults: { conversationId: id, results: [{ ...result, data }], status } } });
    assert(response.ok(), "Fixture control failed");
    await page.goto(`${origin}/oracle?conversation=${id}`);
    await page.getByRole("button", { name: "View details: Route estimate", exact: true }).click();
    await dialog.waitFor();
    return dialog;
  };
  const close = async () => {
    await dialog.getByRole("button", { name: "Close details", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
  };
  const check = async (name, run) => {
    try { await run(); checks.push(name); }
    catch (error) { throw new Error(`After ${checks.length} checks, failed ${name}: ${error.message}`); }
  };
  await page.setViewportSize({ width: 1440, height: 1000 });

  await check("desktop route dialog is wide with map and summary side by side", async () => {
    await open();
    await dialog.locator(".leaflet-overlay-pane path").waitFor();
    const box = await dialog.boundingBox();
    const map = await dialog.getByRole("region", { name: "Saved route map" }).boundingBox();
    const summary = await dialog.getByRole("region", { name: "Route planning summary" }).boundingBox();
    assert(box.width > 1100 && box.width <= 1440, "Dialog did not expand to landscape width");
    assert(summary.x >= map.x + map.width && Math.abs(map.y - summary.y) < 3, "Map and summary do not share a row");
    await page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll('[role="dialog"] .leaflet-tile')];
      return tiles.length > 0 && tiles.every(tile => tile.complete && tile.naturalWidth > 0 && Number(getComputedStyle(tile).opacity) >= 0.99);
    });
    await page.screenshot({ path: "output/playwright/oracle-route-insights-desktop.png", fullPage: true });
  });

  await check("travel, distance, suggested departure, and base comparison have clear emphasis", async () => {
    const summary = dialog.getByRole("region", { name: "Route planning summary" });
    const travel = summary.getByText("75 min", { exact: true });
    assert(await travel.evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 28), "Travel time lacks visual emphasis");
    await summary.getByText("42.5 km", { exact: true }).waitFor();
    await summary.getByText("30 min above the base travel estimate.", { exact: true }).waitFor();
    const suggested = summary.getByText("16 Oct 2026, 15:45 WIB", { exact: true });
    assert(await suggested.evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 20), "Suggested departure lacks emphasis");
    await summary.getByText("Within estimated cutoff", { exact: true }).waitFor();
    await dialog.getByText(result.data.planning_warning, { exact: true }).waitFor();
    await dialog.getByRole("region", { name: "Source and limitations" }).getByText(result.disclaimer, { exact: false }).waitFor();
    await close();
  });

  await check("late departure has a distinct warning and an actionable next step", async () => {
    await open({ ...result.data, departure_datetime: "2026-10-16T16:00:00+07:00", departure_feasible: false,
      planning_warning: "Requested departure is later than the suggested departure for this estimate." });
    await dialog.getByText("Too late for estimated cutoff", { exact: true }).waitFor();
    await dialog.getByText("Revise the planned departure or review a later sailing before dispatch.", { exact: true }).waitFor();
    assert(await dialog.getByText("Within estimated cutoff", { exact: true }).count() === 0, "Late plan received positive status");
    await page.screenshot({ path: "output/playwright/oracle-route-insights-late.png", fullPage: true });
    await close();
  });

  await check("incomplete outcomes do not promote a positive cutoff recommendation", async () => {
    await open(result.data, "failed");
    await dialog.getByText("Incomplete recommendation", { exact: true }).waitFor();
    await dialog.getByText("This turn failed or was interrupted. These saved tool results are not a complete recommendation.", { exact: true }).waitFor();
    assert(await dialog.getByText("Within estimated cutoff", { exact: true }).count() === 0, "Incomplete turn appeared ready for dispatch");
    await close();
  });

  await check("missing timing and geometry stay explicit without fabricated values", async () => {
    await open({ distance_km: 2.5, final_time_min: 0, routing_source: "fixture_route" });
    await dialog.getByText("Cutoff check unavailable", { exact: true }).waitFor();
    await dialog.getByText("Map unavailable for this saved result.", { exact: true }).waitFor();
    await dialog.getByText("0 min", { exact: true }).waitFor();
    assert(await dialog.getByText("Suggested departure", { exact: true }).count() === 0, "Missing suggestion was invented");
    assert(await dialog.getByText("Emission estimate", { exact: true }).count() === 0, "Missing emission was invented");
    await close();
  });

  await check("zero values and negative base differences keep their actual meaning", async () => {
    await open({ ...result.data, base_time_min: 100, emission_kg: 0 });
    await dialog.getByText("25 min below the base travel estimate.", { exact: true }).waitFor();
    await dialog.getByText("0 kg", { exact: true }).waitFor();
    await close();
    await open({ ...result.data, final_time_min: 0, base_time_min: 0 });
    await dialog.getByText("Matches the base travel estimate.", { exact: true }).waitFor();
    await close();
  });

  await check("dated sailing milestones retain midnight boundaries and WIB", async () => {
    await open({ ...result.data, departure_datetime: "2026-10-16T23:00:00+07:00", optimal_departure_datetime: "2026-10-16T23:15:00+07:00",
      latest_gate_in_datetime: "2026-10-17T00:30:00+07:00", vessel_etd: "2026-10-17T01:30:00+07:00" });
    await dialog.getByText("16 Oct 2026, 23:15 WIB", { exact: true }).waitFor();
    await dialog.getByText("17 Oct 2026, 00:30 WIB", { exact: true }).waitFor();
    await dialog.getByText("17 Oct 2026, 01:30 WIB", { exact: true }).waitFor();
    await close();
  });

  await check("small screens prioritize summary and retain bounded scrolling and close controls", async () => {
    const longName = "Batam industrial corridor with a long descriptive loading access road";
    for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 820, height: 700 }]) {
      await page.setViewportSize(size);
      await open({ ...result.data, matched_segment_name: longName });
      const box = await dialog.boundingBox();
      const map = await dialog.getByRole("region", { name: "Saved route map" }).boundingBox();
      const summary = await dialog.getByRole("region", { name: "Route planning summary" }).boundingBox();
      assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height, "Dialog escapes viewport");
      assert(summary.y < map.y, "Mobile puts secondary details before the planning summary");
      assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), "Dialog content overflows horizontally");
      const closeBox = await dialog.getByRole("button", { name: "Close details", exact: true }).boundingBox();
      assert(closeBox.y >= 0 && closeBox.y + closeBox.height <= size.height, "Close control is offscreen");
      if (size.width === 390) await page.screenshot({ path: "output/playwright/oracle-route-insights-mobile.png", fullPage: true });
      await close();
    }
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await open();
  const before = await stats();
  await close();
  await page.getByRole("button", { name: "View details: Route estimate", exact: true }).click();
  await dialog.waitFor();
  const after = await stats();
  assert(after.executions === before.executions && after.requests.length === before.requests.length, "Inspecting the UI reran the route");
  await close();
  return { checks_passed: checks.length, checks, scope: "Chromium with synthetic saved route results; no real chats or routing/provider calls" };
}
