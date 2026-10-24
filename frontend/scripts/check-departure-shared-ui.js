// SYNTHETIC SIMULATION: shared files touched solely to resolve D6 lint failures.
/* eslint-disable @typescript-eslint/no-unused-expressions -- Runner consumes this function expression. */
async (page) => {
  const base = "http://127.0.0.1:3011", fixture = "http://127.0.0.1:9011", checks = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const check = async (name, run) => { try { await run(); checks.push(name); console.log(`PASS ${name}`); } catch (error) { error.completedChecks = [...checks]; error.failedCheck = name; throw error; } };
  await page.request.post(`${fixture}/__control`, { data: { mode: "safe", delay: 0, catalog: "normal" } });
  await check("Password sign-in surfaces synthetic provider error and can recover", async () => {
    await page.goto(`${base}/login`);
    await page.route(`${fixture}/auth/v1/token**`, route => route.fulfill({ status: 400, json: { code: "invalid_credentials", msg: "Synthetic credentials rejected" } }), { times: 1 });
    await page.getByLabel("Email", { exact: true }).fill("a@departure.example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page.getByText("Synthetic credentials rejected", { exact: true }).waitFor();
    assert(await page.getByRole("button", { name: "Sign In", exact: true }).isEnabled(), "sign-in remained disabled");
    await page.getByRole("button", { name: "Sign In", exact: true }).click(); await page.waitForURL("**/dashboard");
  });
  await check("Schedules initial read and manual refresh settle loading state", async () => {
    await page.clock.install({ time: new Date("2026-10-23T16:59:30Z") });
    // The legacy schedules screen expects its own complete row schema.
    // Do not feed departure's deliberately incomplete catalog rows into it.
    const rows = [1, 2].map(n => ({ id: `synthetic-${n}`, terminal_id: "TM001", terminal_name: "Synthetic Batu Ampar", destination: "Fixture Singapore", departure_time: "09:30:00", cutoff_time: "09:00:00", vessel_type: "Synthetic simulation vessel", cargo_capacity_tons: 1 }));
    await page.route(`${fixture}/schedules`, route => route.fulfill({ json: { schedules: rows } }));
    const initial = page.waitForResponse(`${fixture}/schedules`); await page.goto(`${base}/schedules`); await initial;
    const sync = page.getByRole("button", { name: "Sync Now", exact: true }); await sync.waitFor();
    await page.getByRole("table").waitFor();
    assert(await page.getByRole("cell", { name: "Fixture Singapore", exact: true }).count() === 2, "initial schedule rows missing");
    await page.route(`${fixture}/schedules`, async route => {
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({ json: { schedules: [] } });
    }, { times: 1 });
    await sync.click(); await page.getByText("Fetching live schedules...", { exact: false }).waitFor();
    await page.getByRole("heading", { name: "No schedules found", exact: true }).waitFor();
    await sync.click(); await page.getByRole("table").waitFor();
    assert(await page.getByRole("cell", { name: "Fixture Singapore", exact: true }).count() === 2, "refresh did not restore rows");
    await page.unroute(`${fixture}/schedules`);
  });
  await check("Schedules date hydrates consistently and updates across Jakarta midnight", async () => {
    await page.getByText("23/10/2026", { exact: true }).waitFor();
    await page.clock.runFor(60000);
    await page.getByText("24/10/2026", { exact: true }).waitFor();
  });
  await check("Shared mobile breakpoint changes at 768px and sidebar works after resize", async () => {
    await page.goto(`${base}/departure`); await page.setViewportSize({ width: 767, height: 812 });
    const toggle = page.getByRole("button", { name: "Toggle Sidebar", exact: true });
    await toggle.click(); const mobile = page.locator('[data-mobile="true"]'); await mobile.waitFor();
    await page.keyboard.press("Escape"); await mobile.waitFor({ state: "hidden" });
    await page.setViewportSize({ width: 768, height: 900 });
    await page.locator('[data-slot="sidebar-container"]').waitFor();
    assert(await mobile.count() === 0, "mobile sidebar remained at desktop breakpoint");
    await page.setViewportSize({ width: 375, height: 812 }); await toggle.click(); await mobile.waitFor();
    await page.keyboard.press("Escape"); await mobile.waitFor({ state: "hidden" });
  });
  await check("Registration surfaces synthetic provider error and restores submit control", async () => {
    await page.context().clearCookies(); await page.goto(`${base}/register`);
    await page.route(`${fixture}/auth/v1/signup**`, route => route.fulfill({ status: 400, json: { code: "user_already_exists", msg: "Synthetic registration rejected" } }), { times: 1 });
    await page.locator("#fullname").fill("Simulation participant");
    await page.locator("#email").fill("new@departure.example.invalid");
    await page.locator("#password").fill("SyntheticPassword123");
    await page.locator("#confirm").fill("SyntheticPassword123"); await page.locator("#terms").check();
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await page.getByText("Synthetic registration rejected", { exact: true }).waitFor();
    assert(await page.getByRole("button", { name: "Create Account", exact: true }).isEnabled(), "registration remained disabled");
    await page.getByText("I agree to SmartFlow's", { exact: false }).waitFor();
  });
  return { checks_passed: checks.length, checks, scope: "Synthetic regression of lint fixes only; no real sign-up, login or schedule data." };
}
