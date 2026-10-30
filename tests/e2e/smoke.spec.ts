import { expect, test } from "./fixtures";

const PAGES = [
  { link: "Closet", heading: "Your closet", url: /\/closet$/ },
  { link: "Calendar", heading: "Calendar", url: /\/calendar$/ },
  { link: "Profile", heading: "Profile", url: /\/profile$/ },
];

test("nav reaches every section and back home", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation");
  // The purchase check is only on home, not in the nav.
  await expect(nav.getByRole("link", { name: "Should I buy this?" })).toHaveCount(0);

  for (const { link, heading, url } of PAGES) {
    await nav.getByRole("link", { name: link, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await nav.getByRole("link", { name: "fitcheck" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Good for today" })).toBeVisible();
});

test("home leads to the purchase check", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: /^Should I buy this\?/ }).click();
  await expect(page).toHaveURL(/\/check$/);
  await expect(page.getByRole("heading", { name: "Should I buy this?" })).toBeVisible();
});

test("adding clothes starts from the closet", async ({ page }) => {
  await page.goto("/closet");
  await page.getByRole("main").getByRole("link", { name: "Add clothes" }).click();
  await expect(page).toHaveURL(/\/closet\/add$/);
  await expect(page.getByRole("heading", { name: "Add clothes" })).toBeVisible();
});
