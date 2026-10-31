import { expect, test } from "./fixtures";

const PAGES = [
  { link: "Closet", heading: "Your closet", url: /\/closet$/ },
  { link: "Calendar", heading: "Calendar", url: /\/calendar$/ },
  { link: "Profile", heading: "Profile", url: /\/profile$/ },
];

test("nav reaches every section and back home", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation");

  for (const { link, heading, url } of PAGES) {
    await nav.getByRole("link", { name: link, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await nav.getByRole("link", { name: "fitcheck" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Good for today" })).toBeVisible();
});

test("the top bar leads to the purchase check from any page", async ({ page }) => {
  await page.goto("/");
  // Only in the top bar now: home has no tile of its own.
  await expect(page.getByRole("main").getByRole("link", { name: "Should I buy this?" })).toHaveCount(0);
  await page.goto("/closet");
  await page.getByRole("navigation").getByRole("link", { name: "Should I buy this?", exact: true }).click();
  await expect(page).toHaveURL(/\/check$/);
  await expect(page.getByRole("heading", { name: "Should I buy this?" })).toBeVisible();
});

test("home puts the style card left of today's clothes", async ({ page }) => {
  await page.goto("/");
  const today = await page.getByRole("heading", { name: "Good for today" }).boundingBox();
  const style = await page.getByRole("heading", { name: "Your style" }).boundingBox();
  expect(style!.x).toBeLessThan(today!.x);
  expect(Math.abs(style!.y - today!.y)).toBeLessThan(2);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the top bar fits, with a short purchase check", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Buy?", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Calendar", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    // Today's clothes come before the style card.
    const today = await page.getByRole("heading", { name: "Good for today" }).boundingBox();
    const style = await page.getByRole("heading", { name: "Your style" }).boundingBox();
    expect(today!.y).toBeLessThan(style!.y);
  });
});

test("adding clothes starts from the closet", async ({ page }) => {
  await page.goto("/closet");
  // The header's link: the grid can end in an "Add clothes" tile too,
  // depending on how many items there are.
  const header = page.getByRole("heading", { name: "Your closet" }).locator("xpath=..");
  await header.getByRole("link", { name: "Add clothes" }).click();
  await expect(page).toHaveURL(/\/closet\/add$/);
  await expect(page.getByRole("heading", { name: "Add clothes" })).toBeVisible();
});
