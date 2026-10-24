import { expect, test } from "@playwright/test";

const fixtureUrl = `http://127.0.0.1:${process.env.ROUTE_TEST_FIXTURE_PORT || "19010"}`;
const oracleConversation = "00000000-0000-4000-8000-000000000102";

async function setFixture(page: import("@playwright/test").Page, data: object) {
  const response = await page.request.post(`${fixtureUrl}/__control`, { data });
  expect(response.ok()).toBeTruthy();
}

async function routeRequests(page: import("@playwright/test").Page) {
  const response = await page.request.get(`${fixtureUrl}/__stats`);
  const stats = await response.json();
  return stats.requests.filter((request: { path: string }) =>
    ["/route/alternatives", "/route"].includes(request.path),
  );
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const hostname = new URL(route.request().url()).hostname;
    if (hostname === "tile.openstreetmap.org") {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    } else if (hostname === "127.0.0.1" || hostname === "localhost") {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  await setFixture(page, {
    routeFailure: false,
    routeDelay: 0,
    singleRoute: false,
    alternativesUnavailable: false,
  });
});

test("supported location dropdowns submit direct replacements", async ({
  page,
}) => {
  await page.goto("/planner");

  const origin = page.getByLabel("Origin");
  const destination = page.getByLabel("Destination");
  const supportedOptions = [
    "Select origin",
    "Batu Ampar Port",
    "Sekupang Ferry Terminal",
    "Batam Center Terminal",
    "Batamindo Industrial Park",
    "Kabil Industrial Estate",
    "Hang Nadim Airport",
    "Custom coordinates",
  ];
  await expect(origin.locator("option")).toHaveCount(8);
  await expect(destination.locator("option")).toHaveCount(8);
  expect(await origin.locator("option").allTextContents()).toEqual(
    supportedOptions,
  );
  expect(await destination.locator("option").allTextContents()).toEqual([
    "Select destination",
    ...supportedOptions.slice(1),
  ]);
  await expect(origin).toHaveValue("Batamindo Industrial Park");
  await expect(destination).toHaveValue("Batu Ampar Port");

  // Replace both preselected values directly from the supported catalog.
  await origin.selectOption({ label: "Batu Ampar Port" });
  await origin.selectOption({ label: "Batam Center Terminal" });
  await destination.selectOption({ label: "Batamindo Industrial Park" });
  await destination.selectOption({ label: "Sekupang Ferry Terminal" });

  // Leaving the controls closes their native menus without clearing values.
  await origin.click();
  await page.getByLabel("Departure date").click();
  await expect(origin).toHaveValue("Batam Center Terminal");
  await expect(destination).toHaveValue("Sekupang Ferry Terminal");

  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await expect(page.getByRole("status").getByText(/Estimate ready/)).toBeVisible();
  const requests = await routeRequests(page);
  expect(requests.at(-1).body.origin_name).toBe("Batam Center Terminal");
  expect(requests.at(-1).body.origin).toEqual({ lat: 1.1317546, lng: 104.0554292 });
  expect(requests.at(-1).body.destination_name).toBe("Sekupang Ferry Terminal");
  expect(requests.at(-1).body.destination).toEqual({ lat: 1.125047, lng: 103.9249678 });
});

test("location dropdowns support keyboard selection and custom coordinates", async ({
  page,
}) => {
  await page.goto("/planner");

  const origin = page.getByLabel("Origin");
  await origin.focus();
  await origin.press("ArrowDown");
  await origin.press("Enter");
  await expect(origin).toHaveValue("Kabil Industrial Estate");

  await origin.selectOption({ label: "Custom coordinates" });
  const coordinates = page.getByLabel("Origin coordinates");
  await expect(coordinates).toBeVisible();
  await coordinates.fill("1.0604795, 104.0303214");
  await page.getByLabel("Destination").selectOption({ label: "Batam Center Terminal" });
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await expect(page.getByRole("status").getByText(/Estimate ready/)).toBeVisible();

  const requests = await routeRequests(page);
  expect(requests.at(-1).body.origin).toEqual({ lat: 1.0604795, lng: 104.0303214 });
  expect(requests.at(-1).body.origin_name).toBe("1.0604795, 104.0303214");
  expect(requests.at(-1).body.destination_name).toBe("Batam Center Terminal");
});

test("recorded sailings send cutoff inputs and disclose the fixture limitation", async ({
  page,
}) => {
  await page.goto("/planner");

  const sailing = page.getByLabel("Copy a recorded sailing time");
  await expect(sailing).toBeEnabled();
  await sailing.selectOption("fixture-sailing");
  await expect(page.getByLabel("Vessel ETD")).toHaveValue("18:00");

  const dayType = page.getByLabel("Day type");
  await dayType.selectOption("weekend");
  await expect(dayType).toHaveValue("weekend");

  const cargoType = page.getByLabel("Cargo planning category");
  await cargoType.selectOption("FAST_FREIGHT");
  await expect(cargoType).toHaveValue("FAST_FREIGHT");
  await cargoType.selectOption("CONTAINER");
  await expect(cargoType).toHaveValue("CONTAINER");

  const routeResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/route/alternatives"),
  );
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await expect(page.getByRole("status").getByText(/Estimate ready/)).toBeVisible();
  const routeResponse = await routeResponsePromise;
  const routeData = await routeResponse.json();
  expect(routeData).not.toHaveProperty("departure_feasible");
  expect(routeData).not.toHaveProperty("cutoff_slack_min");
  expect(routeData).not.toHaveProperty("calculation_time");
  expect(routeData.route_options.every((option: { routing_source: string }) =>
    option.routing_source === "Synthetic UI fixture",
  )).toBeTruthy();
  const requests = await routeRequests(page);
  expect(requests.at(-1).body.day_type).toBe("weekend");
  expect(requests.at(-1).body.cargo_type).toBe("CONTAINER");
  expect(requests.at(-1).body.vessel_etd).toBe("18:00");
  await expect(page.getByText("Cutoff check unavailable", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Sample fixture timestamp: not supplied/),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Local fixture limitation: this test result does not calculate vessel cutoff feasibility.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText("5 min remaining", { exact: true })).toHaveCount(0);
});

test("fixture timestamp follows the requested date and identifies synthetic provenance", async ({
  page,
}) => {
  await page.goto("/planner");
  await page.getByLabel("Departure date").fill("2026-10-24");

  const routeResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/route/alternatives"),
  );
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  const routeData = await (await routeResponsePromise).json();
  expect(routeData.departure_date).toBe("2026-10-24");
  expect(routeData.calculation_time).toBe("2026-10-24T01:00:00.000Z");
  expect(routeData.routing_source).toBe("Synthetic UI fixture");
  expect(routeData.route_options.map((option: { routing_source: string }) =>
    option.routing_source,
  )).toEqual(["Synthetic UI fixture", "Synthetic UI fixture"]);

  await expect(
    page.getByText(/Sample fixture timestamp: 24\/10\/2026, 08:00:00 WIB/),
  ).toBeVisible();
  await expect(
    page.getByText(/synthetic route options are supplied by the local UI fixture/),
  ).toBeVisible();
  const assumptions = page.getByRole("region", { name: "Route assumptions" });
  await expect(
    assumptions.getByText(/Congestion uses one reference corridor/),
  ).toBeHidden();
  await assumptions.getByText("Estimate breakdown", { exact: true }).click();
  await expect(
    assumptions.getByText("Synthetic UI fixture", { exact: true }),
  ).toBeVisible();
  await expect(assumptions.getByText("OSRM API", { exact: true })).toHaveCount(0);
});

test("route calculation exposes loading, success, and failure feedback", async ({
  page,
}) => {
  await setFixture(page, { routeDelay: 3000, routeFailure: false });
  await page.goto("/planner");
  const requestStarted = page.waitForRequest((request) =>
    request.url().endsWith("/route/alternatives"),
  );
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await requestStarted;

  const calculating = page.getByRole("button", { name: /Calculating route/ });
  await expect(calculating).toBeDisabled();
  await expect(
    page.getByRole("status").getByText(/Estimating the route/),
  ).toBeVisible();
  await expect(
    page.getByRole("status").getByText(/Estimate ready/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Calculate estimate" }),
  ).toBeEnabled();

  await setFixture(page, { routeDelay: 0, routeFailure: true });
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await expect(
    page
      .getByRole("form", { name: "Route planning inputs" })
      .getByRole("alert"),
  ).toContainText(
    "Route data is temporarily unavailable.",
  );
  await expect(
    page.getByRole("button", { name: "Calculate estimate" }),
  ).toBeEnabled();
});

test("route results use two desktop columns and enter view after mobile calculation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/planner");
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  const form = page.getByRole("form", { name: "Route planning inputs" });
  const results = page.getByRole("region", { name: "Route estimate" });
  const formBox = await form.boundingBox();
  const resultBox = await results.boundingBox();
  expect(formBox).not.toBeNull();
  expect(resultBox).not.toBeNull();
  expect(resultBox!.x).toBeGreaterThan(formBox!.x + formBox!.width / 2);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await expect(
    page.getByRole("status").getByText(/Estimate ready/),
  ).toBeInViewport();
});

test("landing page links to real workspaces and avoids unsupported product claims", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Plan a route. Understand the estimate." }),
  ).toBeVisible();
  const mainNavigation = page.getByRole("navigation", {
    name: "Main navigation",
  });
  await expect(
    mainNavigation.getByRole("link", { name: "Route Planner" }),
  ).toHaveAttribute("href", "/planner");
  await expect(
    mainNavigation.getByRole("link", { name: "Ferry Schedules" }),
  ).toHaveAttribute("href", "/schedules");
  await expect(
    mainNavigation.getByRole("link", { name: "Logistics Oracle" }),
  ).toHaveAttribute("href", "/oracle");

  const landingCopy = await page.locator("main").innerText();
  expect(landingCopy).not.toMatch(
    /99\.8%|-30%|missed cut-offs|real-time traffic|real-time port analytics|Scope 3|Tuas checkpoint|autonomous supply chain agent|predictive delay alerts|approve re-route/i,
  );
  expect(landingCopy).toMatch(/synthetic project estimates/i);
  expect(landingCopy).toMatch(/not a measured emission value/i);

  await page.getByRole("link", { name: "Open route planner" }).click();
  await expect(page).toHaveURL(/\/planner$/);
});

test("Planner selects a synthetic alternative and synchronizes route metrics and map", async ({
  page,
}) => {
  await page.goto("/planner");
  const calculate = page.getByRole("button", {
    name: "Calculate estimate",
    exact: true,
  });
  await expect(calculate).toBeVisible();
  await calculate.click();

  const summary = page.getByRole("region", {
    name: "Route planning summary",
  });
  await expect(summary).toBeVisible();
  const first = page.getByRole("radio", { name: "Select Route 1" });
  const second = page.getByRole("radio", { name: "Select Route 2" });
  await expect(first).toBeChecked();
  await expect(second).toBeVisible();

  const polylines = page.locator(".leaflet-overlay-pane path");
  await expect(polylines).toHaveCount(2);
  const secondGeometry = await page
    .locator('.leaflet-overlay-pane path[stroke-width="3"]')
    .getAttribute("d");
  await expect(
    page.locator('.leaflet-overlay-pane path[stroke-width="6"]'),
  ).toHaveCount(1);

  await page
    .getByRole("group", { name: "Available routes" })
    .getByText("Route 2", { exact: true })
    .click();
  await expect(second).toBeChecked();
  await expect(summary.getByText("14 min", { exact: true })).toBeVisible();
  await expect(summary.getByText("7 km", { exact: true })).toBeVisible();
  const selectedCard = second.locator("xpath=..");
  await expect(selectedCard.getByText("LOW · 1.17×", { exact: true })).toBeVisible();
  await expect(
    selectedCard.getByText("1.4 kg · simulation", { exact: true }),
  ).toBeVisible();
  const assumptions = page.getByRole("region", { name: "Route assumptions" });
  await expect(
    assumptions.getByText(/Congestion uses one reference corridor/),
  ).toBeHidden();
  await assumptions.getByText("Estimate breakdown", { exact: true }).click();
  await expect(assumptions.getByText("1.17×", { exact: true })).toBeVisible();
  await expect(assumptions.getByText("1.4 kg", { exact: true })).toBeVisible();
  await expect(
    assumptions.getByText("Synthetic UI fixture", { exact: true }),
  ).toBeVisible();
  const selectedPolyline = page.locator(
    '.leaflet-overlay-pane path[stroke-width="6"]',
  );
  await expect(selectedPolyline).toHaveCount(1);
  await expect(selectedPolyline).toHaveAttribute("d", secondGeometry!);
  await expect(
    page.locator('.leaflet-overlay-pane path[stroke-width="3"]'),
  ).toHaveCount(1);

  const requests = await routeRequests(page);
  expect(requests.at(-1).path).toBe("/route/alternatives");
  expect(requests.at(-1).body.origin.lat).toBeGreaterThan(0);
});

test("single synthetic fixture route is shown without a comparison option", async ({
  page,
}) => {
  await setFixture(page, { singleRoute: true, alternativesUnavailable: false });
  await page.goto("/planner");
  await page.getByRole("button", { name: "Calculate estimate" }).click();

  await expect(page.getByRole("radio", { name: "Select Route 1" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Select Route 2" })).toHaveCount(0);
  await expect(
    page.getByText("The local fixture does not include an alternative.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(1);
});

test("legacy backend fallback keeps a single route and calls only the supported endpoint", async ({
  page,
}) => {
  await setFixture(page, {
    singleRoute: false,
    alternativesUnavailable: true,
  });
  await page.goto("/planner");
  await page.getByRole("button", { name: "Calculate estimate" }).click();

  const summary = page.getByRole("region", {
    name: "Route planning summary",
  });
  await expect(summary).toBeVisible();
  await expect(summary.getByText("5 km", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Select Route 1" })).toHaveCount(
    0,
  );
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(1);

  const requests = await routeRequests(page);
  expect(requests.slice(-2).map((request: { path: string }) => request.path)).toEqual([
    "/route/alternatives",
    "/route",
  ]);
});

test("Oracle saved route stays single-route and does not render Planner alternatives", async ({
  page,
}) => {
  const route = {
    type: "route",
    title: "Route estimate",
    source: "synthetic_fixture",
    data_status: "estimated",
    disclaimer: "Synthetic route estimate for browser regression testing.",
    calculated_at: "2026-10-23T10:00:00Z",
    data: {
      origin: { lat: 1.06048, lng: 104.030321 },
      destination: { lat: 1.162951, lng: 104.002488 },
      origin_name: "Batamindo Industrial Park",
      destination_name: "Batu Ampar Port",
      route_geometry: {
        type: "LineString",
        coordinates: [
          [104.030321, 1.06048],
          [104.002488, 1.162951],
        ],
      },
      routing_source: "OSRM API",
      distance_km: 5,
      base_time_min: 10,
      final_time_min: 15,
      emission_kg: 1.5,
      congestion_multiplier: 1.5,
      congestion_status: "synthetic_estimate",
      departure_time: "10:00",
      departure_date: "2024-01-01",
      planning_timezone: "Asia/Jakarta",
      day_type: "weekday",
    },
  };
  await setFixture(page, {
    savedResults: {
      conversationId: oracleConversation,
      results: [route],
      status: "completed",
    },
  });

  await page.goto(`/oracle?conversation=${oracleConversation}`);
  await page.getByRole("button", { name: "View details: Route estimate" }).click();
  const dialog = page.getByRole("dialog", { name: "Route estimate" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("region", { name: "Saved route map" })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: /Select Route/ })).toHaveCount(0);
  await expect(dialog.locator(".leaflet-overlay-pane path")).toHaveCount(1);
  await expect(dialog.getByText("Available routes", { exact: true })).toHaveCount(
    0,
  );
});
