import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ROUTE_STRIP_NAME = /^Route [A-C], rank/;
const PLAN_TIMEOUT_MILLISECONDS = 30_000;

async function planSampleTrip(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Denver → Dallas" }).click();
  await expect(page.getByRole("button", { name: ROUTE_STRIP_NAME })).toHaveCount(3, {
    timeout: PLAN_TIMEOUT_MILLISECONDS,
  });
}

test("plans a sample trip and recommends the top-ranked route", async ({ page }) => {
  await planSampleTrip(page);

  const routeStrips = page.getByRole("button", { name: ROUTE_STRIP_NAME });
  await expect(routeStrips.first()).toHaveAccessibleName(/rank 1, recommended/);
  await expect(page).toHaveURL(/from=39\.73920%2C-104\.99030/);
  await expect(page).toHaveURL(/every=25/);
});

test("restores a shared trip from the URL", async ({ page }) => {
  await planSampleTrip(page);
  const sharedUrl = page.url();

  await page.goto("about:blank");
  await page.goto(sharedUrl);

  await expect(page.getByRole("button", { name: ROUTE_STRIP_NAME })).toHaveCount(3, {
    timeout: PLAN_TIMEOUT_MILLISECONDS,
  });
  await expect(page.getByRole("combobox").first()).toHaveValue("Denver, CO, USA");
});

test("scrubs and plays the 48-hour forecast timeline", async ({ page }) => {
  await planSampleTrip(page);
  const slider = page.getByRole("slider", { name: "Forecast hour" });

  await slider.fill("12");
  await expect(slider).toHaveAttribute("aria-valuetext", /\+12\.0 h after departure/);

  await page.getByRole("button", { name: "Play forecast playback" }).click();
  await expect(page.getByRole("button", { name: "Pause forecast playback" })).toBeVisible();
  await page.waitForTimeout(600);
  const hourWhilePlaying = Number(await slider.inputValue());
  expect(hourWhilePlaying).toBeGreaterThan(12);
});

test("toggles the colour theme", async ({ page }) => {
  await page.goto("/");
  const initialTheme = await page.locator("html").getAttribute("data-theme");

  await page.getByRole("button", { name: /Switch to (light|dark) theme/ }).click();

  await expect(page.locator("html")).not.toHaveAttribute("data-theme", initialTheme ?? "");
});

test("shows validation errors without calling the API", async ({ page }) => {
  let planRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/trips/plan")) planRequests += 1;
  });
  await page.goto("/");

  await page.getByRole("button", { name: /Find safest route/ }).click();

  await expect(page.getByText("Choose an origin.")).toBeVisible();
  expect(planRequests).toBe(0);
});

test("has no serious accessibility violations once a trip is planned", async ({ page }) => {
  await planSampleTrip(page);

  const results = await new AxeBuilder({ page })
    .exclude(".maplibregl-canvas")
    .exclude(".maplibregl-ctrl-attrib")
    .analyze();
  const seriousViolations = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );

  expect(seriousViolations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});
