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

test("the purchase check starts from the banner on home", async ({ page }) => {
  await page.goto("/");
  // Not in the top bar any more.
  await expect(page.getByRole("navigation").getByRole("link", { name: /buy/i })).toHaveCount(0);
  await page.getByRole("main").getByRole("link", { name: "Should I buy this?", exact: true }).click();
  await expect(page).toHaveURL(/\/check$/);
  await expect(page.getByRole("heading", { name: "Should I buy this?" })).toBeVisible();
});

const INK = "rgb(17, 17, 17)";
const INK_2 = "rgb(107, 107, 107)";
const NAV_LINKS = ["fitcheck", "Closet", "Calendar", "Profile"];
// A persona item from the seed.
const SEED_ITEM_ID = "2262ce87-2107-4b70-8e85-33f8ecb2b8bb";

test("the top bar shows the page you're on in black, the rest in gray", async ({ page }) => {
  const cases = [
    { path: "/", current: "fitcheck" },
    { path: "/closet", current: "Closet" },
    { path: "/closet/add", current: "Closet" },
    { path: `/closet/${SEED_ITEM_ID}`, current: "Closet" },
    { path: "/calendar", current: "Calendar" },
    { path: "/profile", current: "Profile" },
    { path: "/check", current: null },
  ];
  const nav = page.getByRole("navigation");
  for (const { path, current } of cases) {
    await page.goto(path);
    for (const name of NAV_LINKS) {
      const link = nav.getByRole("link", { name, exact: true });
      if (name === current) {
        await expect(link, `${name} on ${path}`).toHaveAttribute("aria-current", "page");
        await expect(link, `${name} on ${path}`).toHaveCSS("color", INK);
      } else {
        await expect(link, `${name} on ${path}`).not.toHaveAttribute("aria-current");
        await expect(link, `${name} on ${path}`).toHaveCSS("color", INK_2);
      }
    }
  }
});

test("the current link follows client-side navigation", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation");
  await nav.getByRole("link", { name: "Closet", exact: true }).click();
  await expect(page).toHaveURL(/\/closet$/);
  await expect(nav.getByRole("link", { name: "Closet", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "fitcheck", exact: true })).not.toHaveAttribute("aria-current");
});

test("home puts the purchase check banner above the style card and today's clothes", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Thinking of buying something?" });
  const box = await banner.boundingBox();
  const text = await banner.getByRole("heading").boundingBox();
  const button = await banner.getByRole("link", { name: "Should I buy this?", exact: true }).boundingBox();
  const today = await page.getByRole("heading", { name: "Good for today" }).boundingBox();
  const style = await page.getByRole("heading", { name: "Your style" }).boundingBox();
  // On the left edge with the style card, the button under the heading at its
  // own width; above both headings.
  expect(Math.abs(text!.x - style!.x)).toBeLessThan(2);
  expect(Math.abs(button!.x - text!.x)).toBeLessThan(2);
  expect(button!.y).toBeGreaterThan(text!.y + text!.height);
  expect(button!.width).toBeLessThan(box!.width / 2);
  expect(box!.y + box!.height).toBeLessThan(Math.min(today!.y, style!.y));
  expect(style!.x).toBeLessThan(today!.x);
  expect(Math.abs(style!.y - today!.y)).toBeLessThan(2);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the top bar fits, and home opens with the purchase check", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Calendar", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: /buy/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    // The banner first: heading centered, the button full width under it;
    // then today's clothes, then the style card.
    const banner = page.getByRole("region", { name: "Thinking of buying something?" });
    const text = await banner.getByRole("heading").boundingBox();
    const button = await banner.getByRole("link", { name: "Should I buy this?", exact: true }).boundingBox();
    const box = await banner.boundingBox();
    expect(button!.y).toBeGreaterThan(text!.y + text!.height);
    expect(Math.abs(button!.width - box!.width)).toBeLessThan(2);
    expect(Math.abs(text!.x + text!.width / 2 - (box!.x + box!.width / 2))).toBeLessThan(2);
    const today = await page.getByRole("heading", { name: "Good for today" }).boundingBox();
    const style = await page.getByRole("heading", { name: "Your style" }).boundingBox();
    expect(box!.y + box!.height).toBeLessThan(today!.y);
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
