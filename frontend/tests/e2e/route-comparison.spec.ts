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
});

test("Planner selects a real alternative and synchronizes route metrics and map", async ({
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

test("single OSRM route is shown without a fabricated comparison option", async ({
  page,
}) => {
  await setFixture(page, { singleRoute: true, alternativesUnavailable: false });
  await page.goto("/planner");
  await page.getByRole("button", { name: "Calculate estimate" }).click();

  await expect(page.getByRole("radio", { name: "Select Route 1" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Select Route 2" })).toHaveCount(0);
  await expect(
    page.getByText("The routing service did not return an alternative.", {
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
