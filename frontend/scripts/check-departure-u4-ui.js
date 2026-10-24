// SYNTHETIC SIMULATION: moderator-fixture readiness, never participant evidence.
/* eslint-disable @typescript-eslint/no-unused-expressions -- Runner consumes this function expression. */
async (page) => {
  const base = "http://127.0.0.1:3011", fixture = "http://127.0.0.1:9011", checks = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const check = async (name, run) => { try { await run(); checks.push(name); console.log(`PASS ${name}`); } catch (error) { error.completedChecks = [...checks]; error.failedCheck = name; throw error; } };
  const control = async (mode, delay = 0) => { assert((await page.request.post(`${fixture}/__control`, { data: { mode, delay, catalog: "normal" } })).ok(), "fixture control failed"); };
  const calculate = async () => {
    const response = page.waitForResponse(r => r.url() === `${fixture}/departure-recommendation`);
    await page.getByRole("button", { name: "Calculate recommendation", exact: true }).click();
    const r = await response; assert(r.status() === 200, "fixture did not return HTTP 200"); return r.json();
  };
  const result = () => page.getByRole("region", { name: "Departure recommendation", exact: true });
  const status = name => result().getByRole("heading", { name, exact: true }).waitFor();
  await control("overnight");
  await page.goto(`${base}/login`);
  await page.getByLabel("Email", { exact: true }).fill("a@departure.example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL("**/dashboard"); await page.goto(`${base}/departure`);
  await page.locator("#dep-origin").fill("Batamindo");
  await page.locator("#dep-terminal").selectOption("batu_ampar");
  await page.locator("#dep-ferry_destination").fill("Fixture Singapore");
  await page.locator("#dep-service_kind").selectOption("cargo");
  await page.locator("#dep-departure_date").fill("2026-10-23");
  await page.locator("#dep-departure_time").fill("23:50");
  await page.locator("#dep-service_date").fill("2026-10-24");
  await page.locator("#dep-schedule_id").selectOption("00000000-0000-4000-8000-000000000001");
  const fact = label => result().locator("dl > div").filter({ has: page.locator("dt", { hasText: label }) }).locator("dd");
  await check("Overnight: explicit next-day service, ETA and fixed cutoff render in WIB", async () => {
    const data = await calculate(); await status("SAFE");
    assert(data.estimated_arrival_at === "2026-10-24T00:20:00.000+07:00" && data.buffer_min === 20, "wrong overnight ETA/buffer");
    assert(data.selected_schedule.cutoff_at === "2026-10-24T00:40:00.000+07:00", "wrong fixed cutoff");
    assert((await fact("Road departure").innerText()).includes("23 Oct 2026") && (await fact("Road departure").innerText()).includes("23:50"), "road date lost");
    assert((await fact("Decision terminal ETA").innerText()).includes("24 Oct 2026") && (await fact("Decision terminal ETA").innerText()).includes("00:20"), "ETA date lost");
    assert((await result().innerText()).includes("Synthetic sailing scenario"), "simulation label missing");
  });
  await check("Overnight road revision changes SAFE to RISKY without moving the sailing", async () => {
    await page.locator("#dep-departure_date").fill("2026-10-24");
    await page.locator("#dep-departure_time").fill("00:00");
    // This occurrence permits either its preceding road date or its own service date.
    const data = await calculate(); await status("RISKY");
    assert(data.buffer_min === 10 && data.selected_schedule.cutoff_at === "2026-10-24T00:40:00.000+07:00", "road revision moved cutoff");
    assert(data.estimated_arrival_at.startsWith("2026-10-24T00:30:"), "revised ETA wrong");
  });
  await check("Singapore source date converts to previous Jakarta service date", async () => {
    await control("source-zone"); await page.locator("#dep-departure_date").fill("2026-10-23");
    await page.locator("#dep-departure_time").fill("22:00"); await page.locator("#dep-service_date").fill("2026-10-23");
    const data = await calculate(); await status("SAFE");
    assert(data.buffer_min === 30 && data.selected_schedule.source_timezone === "Asia/Singapore", "source metadata lost");
    assert(data.selected_schedule.source_departure_at === "2026-10-24T00:30:00.000+08:00" && data.selected_schedule.departure_at === "2026-10-23T23:30:00.000+07:00", "source date conversion wrong");
    await result().locator("summary").click();
    assert((await fact("Source timezone").innerText()) === "Asia/Singapore", "source zone not displayed");
    assert((await fact("Original departure / cutoff").innerText()).includes("2026-10-24T00:30:00.000+08:00"), "original clock/date hidden");
    assert((await fact("Ferry departure").innerText()).includes("23 Oct 2026") && (await fact("Ferry departure").innerText()).includes("23:30"), "normalized date wrong");
  });
  await check("U4 delayed source-zone response is discarded after editing; recalculation uses new road time", async () => {
    await control("source-zone", 1200);
    const pending = page.waitForRequest(r => r.url() === `${fixture}/departure-recommendation`);
    await page.getByRole("button", { name: "Calculate recommendation", exact: true }).click(); await pending;
    await page.locator("#dep-departure_time").fill("22:20");
    assert(await result().count() === 0, "edit kept old result");
    await page.waitForTimeout(1500); assert(await result().count() === 0, "delayed completion restored stale result");
    await control("source-zone"); const data = await calculate(); await status("RISKY");
    assert(data.buffer_min === 10 && data.selected_schedule.cutoff_at.startsWith("2026-10-23T23:00:"), "new plan not recalculated against fixed cutoff");
  });
  await check("U4 source details fit at 375px and remain keyboard accessible", async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile overflow");
    const summary = result().locator("summary"); await summary.focus();
    if (!(await result().locator("details").evaluate(node => node.open))) await page.keyboard.press("Enter");
    assert(await result().locator("details").evaluate(node => node.open), "keyboard source toggle failed");
    await page.screenshot({ path: `${process.env.DEPARTURE_EVIDENCE_DIR}/u4-mobile-375.png`, fullPage: true });
  });
  return { checks_passed: checks.length, checks, participant_sessions: 0, scope: "Synthetic U4 fixture readiness only; no participant or live evidence." };
}
