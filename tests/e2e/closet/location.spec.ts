import type { BrowserContext } from "@playwright/test";
import { FIXED_CITIES } from "../../../lib/profile/geocode";
import { LOCATION_COOKIE, parseLocationCookie } from "../../../lib/weather/location-cookie";
import { FIXED_WEATHER } from "../../../lib/weather/today";
import { expect, test } from "../fixtures";

// The weather location lives only in browser cookies, so these tests touch no
// database rows. The server runs with WEATHER_MODE=fixed: temps are always
// FIXED_WEATHER's, named after the location cookie, and city search uses
// FIXED_CITIES.
const TEMPS = `${FIXED_WEATHER.lowF}–${FIXED_WEATHER.highF}°F`;
const CHICAGO = FIXED_CITIES[0];

async function storedLocation(context: BrowserContext) {
  const cookie = (await context.cookies()).find((c) => c.name === LOCATION_COOKIE);
  return parseLocationCookie(cookie ? decodeURIComponent(cookie.value) : null);
}

test("a new visitor picks a city and home's weather follows", async ({ page, context }) => {
  await page.goto("/");
  const good = page.getByRole("region", { name: "Good for today" });
  await expect(good).toContainText(`${FIXED_WEATHER.city} · ${TEMPS}`);

  await good.getByRole("link", { name: "Change weather location" }).click();
  await expect(page).toHaveURL(/\/profile#weather$/);
  const weather = page.getByRole("region", { name: "Weather location" });
  await expect(weather.getByTestId("weather-location")).toHaveText("Not set");

  await weather.getByRole("button", { name: "Change" }).click();
  await weather.getByRole("searchbox", { name: "City" }).fill("Chi");
  await weather.getByRole("button", { name: "Search" }).click();
  await weather.getByRole("button", { name: CHICAGO.label }).click();
  await expect(weather.getByRole("status")).toHaveText("Saved");
  await expect(weather.getByTestId("weather-location")).toHaveText(CHICAGO.label);
  expect(await storedLocation(context)).toEqual({ src: "picked", lat: CHICAGO.lat, lon: CHICAGO.lon, city: CHICAGO.label });

  await page.getByRole("navigation").getByRole("link", { name: "fitcheck" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(good).toContainText(`Chicago · ${TEMPS}`);

  await page.reload();
  await expect(good).toContainText(`Chicago · ${TEMPS}`);
});

test("going back to my location without permission falls back to the guess", async ({ page, context }) => {
  await context.addCookies([
    {
      name: LOCATION_COOKIE,
      value: encodeURIComponent(JSON.stringify({ src: "picked", lat: CHICAGO.lat, lon: CHICAGO.lon, city: CHICAGO.label })),
      url: "http://localhost:5129",
    },
  ]);
  await page.goto("/profile#weather");
  const weather = page.getByRole("region", { name: "Weather location" });
  await expect(weather.getByTestId("weather-location")).toHaveText(CHICAGO.label);

  await weather.getByRole("button", { name: "Use my location" }).click();
  await expect(weather.getByRole("status")).toHaveText("Couldn't get your location, so we'll guess.");
  await expect(weather.getByTestId("weather-location")).toHaveText("Not set");
  expect(await storedLocation(context)).toBeNull();

  await page.goto("/");
  await expect(page.getByRole("region", { name: "Good for today" })).toContainText(`${FIXED_WEATHER.city} · ${TEMPS}`);
});

test("a search with no match says so", async ({ page }) => {
  await page.goto("/profile");
  const weather = page.getByRole("region", { name: "Weather location" });
  await weather.getByRole("button", { name: "Change" }).click();
  await weather.getByRole("searchbox", { name: "City" }).fill("Atlantis");
  await weather.getByRole("button", { name: "Search" }).click();
  await expect(weather.getByText("No match. Try adding the state or country.")).toBeVisible();
  await weather.getByRole("button", { name: "Cancel" }).click();
  await expect(weather.getByRole("searchbox", { name: "City" })).toHaveCount(0);
});

test.describe("with location permission", () => {
  test.use({ geolocation: { latitude: 41.8781, longitude: -87.6298 }, permissions: ["geolocation"] });

  test("home uses the device's location", async ({ page, context }) => {
    await page.goto("/");
    const good = page.getByRole("region", { name: "Good for today" });
    await expect(good).toContainText(`Near you · ${TEMPS}`);
    expect(await storedLocation(context)).toEqual({ src: "device", lat: 41.88, lon: -87.63 });
  });

  test("a picked city still wins over the device's location", async ({ page, context }) => {
    await page.goto("/profile#weather");
    const weather = page.getByRole("region", { name: "Weather location" });
    await weather.getByRole("button", { name: "Change" }).click();
    await weather.getByRole("searchbox", { name: "City" }).fill("Sea");
    await weather.getByRole("button", { name: "Search" }).click();
    await weather.getByRole("button", { name: FIXED_CITIES[1].label }).click();
    await expect(weather.getByTestId("weather-location")).toHaveText(FIXED_CITIES[1].label);

    await page.getByRole("navigation").getByRole("link", { name: "fitcheck" }).click();
    const good = page.getByRole("region", { name: "Good for today" });
    await expect(good).toContainText(`Seattle · ${TEMPS}`);
    await page.waitForLoadState("networkidle");
    expect((await storedLocation(context))?.src).toBe("picked");

    await page.goto("/profile#weather");
    await weather.getByRole("button", { name: "Use my location" }).click();
    await expect(weather.getByTestId("weather-location")).toHaveText("Your location");
    await page.goto("/");
    await expect(good).toContainText(`Near you · ${TEMPS}`);
  });
});
