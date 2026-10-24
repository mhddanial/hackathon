// D6-01 synthetic browser acceptance; consumes the existing D5 UI checks.
// No user Chrome, .env reads, real login/API, or persisted Auth state.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const evidence = fileURLToPath(new URL("./", import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require("/private/tmp/departure-headless-d5-06/node_modules/playwright");
process.env.DEPARTURE_EVIDENCE_DIR = evidence;
const u4 = process.argv.includes("--u4");
const shared = process.argv.includes("--shared");
const routeRegression = process.argv.includes("--route");
const artifact = u4 ? "u4-browser" : shared ? "shared-browser" : routeRegression ? "route-browser" : "browser";
let source = await readFile(join(root, u4 ? "frontend/scripts/check-departure-u4-ui.js" : shared ? "frontend/scripts/check-departure-shared-ui.js" : routeRegression ? "frontend/scripts/check-route-integration-ui.js" : "frontend/scripts/check-departure-ui.js"), "utf8");
if (routeRegression) source = source.replaceAll("127.0.0.1:3010", "127.0.0.1:3011").replaceAll("127.0.0.1:9010", "127.0.0.1:9011").replaceAll("output/playwright/", evidence);
const run = new Function(`return (\n${source}\n);`)();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: "Asia/Jakarta", locale: "en-GB", reducedMotion: "reduce" });
const blocked = new Set(), errors = [], pageErrorDetails = [], cancelled = [], responses = [], captures = [];
await context.route("**/*", async route => {
  const url = new URL(route.request().url());
  if (url.hostname !== "127.0.0.1" || !["3011", "9011"].includes(url.port)) { blocked.add(url.hostname); await route.abort(); }
  else await route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(15000);
page.on("pageerror", error => {
  errors.push(error.name);
  pageErrorDetails.push({ name: error.name, message: error.message.replace(/eyJ[\w.-]+/g, "[redacted synthetic token]").slice(0, 1000), page_path: new URL(page.url()).pathname });
});
page.on("requestfailed", request => { if (new URL(request.url()).pathname === "/departure-recommendation") cancelled.push({ input: request.postDataJSON(), error: request.failure()?.errorText }); });
page.on("response", response => {
  if (new URL(response.url()).pathname !== "/departure-recommendation") return;
  captures.push((async () => {
    const body = await response.json().catch(() => null);
    responses.push({ input: response.request().postDataJSON(), http_status: response.status(), actual: body });
  })());
});
const result = { task: u4 ? "D6-04_FIXTURE_PREPARATION" : shared ? "D6-05_SHARED_LINT_REGRESSIONS" : routeRegression ? "D6-03_ROUTE_REGRESSION" : "D6-01", date: "2026-10-24", timezone: "Asia/Jakarta", provenance: "SYNTHETIC SIMULATION ONLY: real headless Next UI with loopback fake Auth/API. No live backend, real login/sailing/traffic or participant evidence.", browser: browser.version() };
try {
  if (routeRegression) {
    await page.goto("http://127.0.0.1:3011/login");
    await page.getByLabel("Email", { exact: true }).fill("a@sprint4.example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page.waitForURL("**/dashboard");
  }
  Object.assign(result, await run(page));
  if (errors.length) throw new Error("Uncaught page errors observed.");
  result.result = "passed";
} catch (error) {
  result.result = "failed"; result.checks = error.completedChecks || result.checks || []; result.failed_check = error.failedCheck || (errors.length ? "uncaught_page_error" : "setup"); result.error = String(error.message).slice(0, 2000);
  await page.screenshot({ path: join(evidence, `${artifact}-failure.png`), fullPage: true }); process.exitCode = 1;
} finally {
  await Promise.allSettled(captures);
  Object.assign(result, { blocked_external_hosts: [...blocked], page_error_names: errors, page_error_details: pageErrorDetails, cancelled_requests: cancelled, responses });
  await writeFile(join(evidence, `${artifact}-acceptance.json`), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ task: result.task, result: result.result, checks_passed: result.checks_passed, failed_check: result.failed_check, cancelled: cancelled.length, page_errors: errors.length }));
  await context.close(); await browser.close();
}
