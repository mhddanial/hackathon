// D5-06: isolated headless Chromium + synthetic loopback services only.
// Install Playwright externally; never use a system Chrome profile or persist Auth tokens.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(join(process.env.DEPARTURE_PLAYWRIGHT_DIR || "/private/tmp/departure-headless-d5-06/node_modules", "playwright"));
const evidence = fileURLToPath(new URL("../../docs/departure/evidence/sprint-5/", import.meta.url));
await mkdir(evidence, { recursive: true });
process.env.DEPARTURE_EVIDENCE_DIR = evidence;
const routeRegression = process.argv.includes("--route-regression");
let script = await readFile(new URL(routeRegression ? "./check-route-integration-ui.js" : "./check-departure-ui.js", import.meta.url), "utf8");
if (routeRegression) script = script.replaceAll("127.0.0.1:3010", "127.0.0.1:3011").replaceAll("127.0.0.1:9010", "127.0.0.1:9011").replaceAll("output/playwright/", evidence);
const run = new Function(`return (\n${script}\n);`)();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: "Asia/Jakarta", locale: "en-GB", reducedMotion: "reduce" });
const blocked = new Set(), pageErrors = [], failures = [];
await context.route("**/*", async route => {
  const url = new URL(route.request().url());
  if (url.hostname !== "127.0.0.1" || !["3011", "9011"].includes(url.port)) { blocked.add(url.hostname); await route.abort(); return; }
  await route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(15000);
page.on("pageerror", error => pageErrors.push(error.name));
page.on("requestfailed", request => { const url = new URL(request.url()); if (url.pathname === "/departure-recommendation") failures.push({ path: url.pathname, error: request.failure()?.errorText }); });
const metadata = { task: "D5-06", provenance: "SYNTHETIC SIMULATION; isolated headless browser and loopback fake Auth/API. No real login, backend, sailings or observed traffic.", browser: browser.version(), viewport_mobile: routeRegression ? 390 : 375, blocked_external_hosts: [], page_error_names: pageErrors, cancelled_requests: failures };
try {
  if (routeRegression) {
    await page.goto("http://127.0.0.1:3011/login");
    await page.getByLabel("Email", { exact: true }).fill("a@sprint4.example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page.waitForURL("**/dashboard");
  }
  const result = await run(page);
  if (pageErrors.length) throw new Error("Uncaught page errors observed; see sanitized error names.");
  Object.assign(metadata, { result: "passed", ...result });
} catch (error) {
  await page.screenshot({ path: join(evidence, routeRegression ? "route-headless-failure.png" : "headless-failure.png"), fullPage: true });
  Object.assign(metadata, { result: "failed", checks: error.completedChecks || [], failed_check: error.failedCheck || "setup", focus: await page.evaluate(() => ({ id: document.activeElement?.id, tag: document.activeElement?.tagName, invalid: [...document.querySelectorAll('[aria-invalid="true"]')].map(node => node.id) })), error: String(error.message).slice(0, 2500) });
  process.exitCode = 1;
} finally {
  metadata.blocked_external_hosts = [...blocked];
  await writeFile(join(evidence, routeRegression ? "route-headless-verification.json" : "headless-verification.json"), JSON.stringify(metadata, null, 2) + "\n");
  console.log(JSON.stringify(metadata));
  await context.close(); await browser.close();
}
