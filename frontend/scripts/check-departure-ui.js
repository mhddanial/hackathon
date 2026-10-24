// Playwright-CLI run-code file, matching existing UI-check conventions.
// Isolated headless runner uses synthetic Next on :3011,
// departure-ui-fixture.mjs on :9011; this script never targets live services.
/* eslint-disable @typescript-eslint/no-unused-expressions -- CLI consumes this function expression. */
async (page) => {
  const base = "http://127.0.0.1:3011", fixture = "http://127.0.0.1:9011", checks = [];
  const evidence = process.env.DEPARTURE_EVIDENCE_DIR || "output/playwright";
  const keyboardEvidence = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const control = async data => { const response = await page.request.post(`${fixture}/__control`, { data }); assert(response.ok(), "fixture control failed"); };
  const requests = async () => (await (await page.request.get(`${fixture}/__stats`)).json()).requests;
  const check = async (name, run) => { try { await run(); checks.push(name); console.log(`PASS ${name}`); } catch (error) { error.completedChecks = [...checks]; error.failedCheck = name; throw error; } };
  const login = async email => {
    await page.goto(`${base}/login`); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill("synthetic-password"); await page.getByRole("button", { name: "Sign In", exact: true }).click(); await page.waitForURL("**/dashboard"); await page.goto(`${base}/departure`);
  };
  const fill = async () => {
    await page.locator("#dep-origin").fill("Batamindo"); await page.locator("#dep-terminal").selectOption("batu_ampar"); await page.locator("#dep-ferry_destination").fill("Fixture Singapore"); await page.locator("#dep-service_kind").selectOption("cargo"); await page.locator("#dep-departure_date").fill("2026-10-23"); await page.locator("#dep-departure_time").fill("08:00"); await page.locator("#dep-service_date").fill("2026-10-23");
  };
  const calculate = () => page.getByRole("button", { name: "Calculate recommendation", exact: true }).click();
  const result = () => page.getByRole("region", { name: "Departure recommendation", exact: true });
  const status = name => result().getByRole("heading", { name, exact: true }).waitFor();
  await control({ mode: "safe", delay: 0, catalog: "normal" }); await page.setViewportSize({ width: 1440, height: 1100 });
  await check("Unauthenticated departure is protected", async () => { await page.context().clearCookies(); await page.goto(`${base}/departure`); await page.waitForURL("**/login"); });
  await check("Synthetic sign-in reaches the protected departure page", async () => { await login("a@departure.example.invalid"); await page.getByRole("heading", { name: "Departure Recommendation", exact: true }).waitFor(); }); await fill();
  await check("Automatic SAFE; simulation source; result heading focused", async () => {
    await calculate(); await status("SAFE"); assert((await requests()).at(-1).body.schedule_id === null, "not automatic"); assert(await result().getByRole("heading", { name: "SAFE", exact: true }).evaluate(node => node === document.activeElement), "result not focused"); assert(await result().innerText().then(text => text.includes("Planning simulation")), "simulation label absent");
  });
  await check("Catalog target retains binding and unknown metadata", async () => {
    await page.locator("#dep-schedule_id").selectOption("00000000-0000-4000-8000-000000000001"); assert(await result().count() === 0, "stale result"); await page.getByText("Source timezone / verification", { exact: true }).waitFor(); await calculate(); await status("SAFE"); assert((await requests()).at(-1).body.schedule_id.endsWith("0001"), "target lost");
  });
  for (const [mode, word] of [["risky", "RISKY"], ["missed", "MISSED"], ["fraction", "MISSED"]]) await check(`${word} / ${mode} preserves signed buffer and target`, async () => { await control({ mode }); await calculate(); await status(word); const text = await result().innerText(); assert(text.includes(mode === "risky" ? "+0.00 min" : mode === "fraction" ? "less than 0.01 min late" : "−5.00 min"), "buffer lost"); assert(text.includes("00000000-0000-4000-8000-000000000001"), "target replaced"); });
  await check("Alternative selection keeps road date/time and recalculates", async () => { const before = (await requests()).at(-1).body; await page.getByRole("button", { name: "Choose and recalculate", exact: true }).first().click(); await status("SAFE"); const after = (await requests()).at(-1).body; assert(after.schedule_id !== before.schedule_id && after.departure_date === before.departure_date && after.departure_time === before.departure_time, "alternative changed road plan"); });
  for (const mode of ["unavailable", "empty", "stale", "fallback", "truncated"]) await check(`UNAVAILABLE ${mode} has no alternatives or decision buffer`, async () => {
    await control({ mode }); await page.locator("#dep-schedule_id").selectOption(""); await calculate(); await status("UNAVAILABLE"); assert(await page.getByRole("button", { name: "Choose and recalculate" }).count() === 0, "alternatives on unavailable"); assert((await result().innerText()).includes("Unavailable"), "decision not unavailable");
  });
  for (const mode of ["outage", "malformed"]) await check(`${mode} removes success and offers retry`, async () => { await control({ mode: "safe" }); await calculate(); await status("SAFE"); await control({ mode }); await calculate(); await page.getByRole("alert").filter({ hasText: /unavailable|validated/ }).waitFor(); assert(await result().count() === 0, "stale success"); await page.getByRole("button", { name: "Retry recommendation" }).waitFor(); });
  await check("422/mismatch/404 link corrective fields", async () => {
    for (const mode of ["validation", "mismatch", "missing"]) { if (mode === "missing") await page.locator("#dep-schedule_id").selectOption("00000000-0000-4000-8000-000000000001"); await control({ mode }); await calculate(); const first = page.locator('[aria-invalid="true"]').first(); await first.waitFor(); assert(await first.evaluate(node => node === document.activeElement), `server validation focus missing for ${mode}: ${await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName)}`); assert(await result().count() === 0, "error kept result"); }
  });
  await check("Invalid form does not call API and focuses linked field", async () => { await control({ mode: "safe" }); await page.locator("#dep-origin").fill("Unknown warehouse"); const count = (await requests()).length; await calculate(); assert((await requests()).length === count, "invalid origin requested"); assert(await page.locator("#dep-origin").evaluate(node => node === document.activeElement), "invalid field not focused"); await fill(); });
  await check("Edit and Stop discard delayed completions", async () => {
    await control({ mode: "safe", delay: 1000 }); await calculate(); await page.getByRole("button", { name: "Stop", exact: true }).waitFor(); await page.locator("#dep-departure_time").fill("09:00"); await page.waitForTimeout(1200); assert(await result().count() === 0, "edited result reappeared");
    await calculate(); await page.getByRole("button", { name: "Stop", exact: true }).click(); await page.waitForTimeout(1200); assert(await result().count() === 0, "stopped result reappeared"); await control({ delay: 0 }); await fill();
  });
  await check("Fixed-duration road-time action clears result and waits for Calculate", async () => { await calculate(); await status("SAFE"); const count = (await requests()).length; await page.getByRole("button", { name: "Use this road time", exact: true }).click(); assert(await page.locator("#dep-departure_date").evaluate(node => node === document.activeElement), "road date focus missing"); assert(await result().count() === 0 && (await requests()).length === count, "road-time action calculated automatically"); await fill(); });
  await check("No alternatives and selected-target truncation remain explicit", async () => {
    await control({ mode: "safe" }); await page.locator("#dep-schedule_id").selectOption("00000000-0000-4000-8000-000000000001");
    for (const truncated of [false, true]) {
      await page.route(`${fixture}/departure-recommendation`, async route => {
        const response = await route.fetch(), data = await response.json(); data.alternatives = []; data.selection.truncated = truncated;
        if (truncated) data.warnings.push({ code: "ALTERNATIVES_TRUNCATED", message: "Synthetic simulation: alternatives comparison is incomplete." });
        await route.fulfill({ response, json: data });
      }, { times: 1 });
      await calculate(); await status("SAFE"); assert(await page.getByRole("button", { name: "Choose and recalculate" }).count() === 0, "unavailable alternative action"); await page.getByText("No evaluated feasible alternatives on this service date.", { exact: true }).waitFor();
      if (truncated) await page.getByText(/Candidate limit reached. Comparison is incomplete; alternatives are withheld/).waitFor();
    }
    await page.locator("#dep-schedule_id").selectOption("");
  });
  await check("Desktop/mobile screenshots and no horizontal overflow", async () => {
    await calculate(); await status("SAFE"); await page.screenshot({ path: `${evidence}/departure-desktop.png`, fullPage: true }); await page.setViewportSize({ width: 375, height: 812 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile overflow"); await page.screenshot({ path: `${evidence}/departure-mobile-375.png`, fullPage: true });
  });
  await check("Real Tab/Shift-Tab traversal, source toggle and touch targets at 375 px", async () => {
    const ids = ["origin", "terminal", "ferry_destination", "service_kind", "departure_date", "departure_time", "service_date", "schedule_id"];
    await page.locator("#dep-origin").focus();
    for (let i = 1; i < ids.length; i++) {
      const previous = `dep-${ids[i - 1]}`;
      let active, presses = 0;
      do { await page.keyboard.press("Tab"); active = await page.evaluate(() => document.activeElement?.id); presses++; } while (active === previous && presses < 8);
      assert(active === `dep-${ids[i]}`, `keyboard expected ${ids[i]}, got ${active}`); keyboardEvidence.push({ control: active, tab_presses: presses });
      assert(await page.locator(`#${active}`).evaluate(node => node.matches(":focus-visible")), "keyboard focus is not visible");
    }
    await page.keyboard.press("Tab");
    assert(await page.getByRole("button", { name: "Calculate recommendation", exact: true }).evaluate(node => node === document.activeElement), "Calculate is not next");
    await page.keyboard.press("Shift+Tab"); assert(await page.locator("#dep-schedule_id").evaluate(node => node === document.activeElement), "reverse traversal missed target");
    await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
    assert(await page.getByRole("button", { name: "Reload recorded sailings", exact: true }).evaluate(node => node === document.activeElement), "catalog action is not next");
    await page.keyboard.press("Tab"); assert(await page.getByRole("button", { name: "Use this road time", exact: true }).evaluate(node => node === document.activeElement), "result action is not next");
    await page.keyboard.press("Tab"); const summary = result().locator("summary"); assert(await summary.evaluate(node => node === document.activeElement), "sources unreachable by keyboard");
    await page.keyboard.press("Enter"); assert(await result().locator("details").evaluate(node => node.open), "sources did not open");
    await page.keyboard.press("Enter"); await page.keyboard.press("Tab");
    assert(await page.getByRole("button", { name: "Revise plan", exact: true }).evaluate(node => node === document.activeElement), "Revise is not next");
    await page.keyboard.press("Tab"); assert(await page.getByRole("button", { name: "Choose and recalculate", exact: true }).first().evaluate(node => node === document.activeElement), "alternative action is not next");
    for (const id of ids) assert((await page.locator(`#dep-${id}`).boundingBox()).height >= 44, "small form touch target");
    assert((await summary.boundingBox()).height >= 44, "sources toggle touch target is below 44 px");
    await page.getByRole("button", { name: "Revise plan", exact: true }).click(); assert(await page.locator("#dep-origin").evaluate(node => node === document.activeElement), "Revise did not focus origin");
  });
  await check("Keyboard Stop cancels the pending request", async () => {
    await control({ mode: "safe", delay: 1000 }); await calculate(); await page.getByRole("button", { name: "Stop", exact: true }).waitFor(); await page.locator("#dep-schedule_id").focus(); await page.keyboard.press("Tab");
    assert(await page.getByRole("button", { name: "Stop", exact: true }).evaluate(node => node === document.activeElement), "Stop is not next while Calculate is disabled"); await page.keyboard.press("Enter"); await page.getByRole("status").filter({ hasText: "Calculation stopped" }).waitFor(); await page.waitForTimeout(1200); assert(await result().count() === 0, "keyboard stop restored result"); await control({ delay: 0 });
  });
  await check("A slower old SAFE request cannot replace a newer RISKY result", async () => {
    await fill(); await control({ mode: "safe", delay: 1200 }); await calculate(); await page.getByRole("button", { name: "Stop", exact: true }).waitFor(); await page.locator("#dep-departure_time").fill("09:00"); await control({ mode: "risky", delay: 0 }); await calculate(); await status("RISKY"); await page.waitForTimeout(1400); await status("RISKY"); assert((await requests()).at(-1).body.departure_time === "09:00", "new road time lost"); await control({ mode: "safe" }); await fill(); await calculate(); await status("SAFE");
  });
  await check("401 clears results and requires sign-in", async () => { await control({ mode: "expired" }); await calculate(); await page.getByRole("link", { name: "Sign in again", exact: true }).waitFor(); assert(await result().count() === 0, "401 retained result"); });
  await check("Logout and another account clear all departure state", async () => {
    await control({ mode: "safe" }); await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click(); await page.getByRole("button", { name: "Open account menu", exact: true }).click(); await page.getByRole("menuitem", { name: "Sign out", exact: true }).click(); await page.waitForURL("**/login"); await login("b@departure.example.invalid"); assert(await result().count() === 0 && await page.locator("#dep-ferry_destination").inputValue() === "", "account-scoped state leaked");
  });
  return { checks_passed: checks.length, checks, keyboard: keyboardEvidence, scope: "Isolated headless Chromium with synthetic Auth/API; actual Tab/Shift-Tab traversal. Layout screenshots require recorded inspection; no real login/backend acceptance." };
}
