import { expect, test } from "./fixtures";

const PAGES = [
  { link: "Closet", heading: "Your closet", url: /\/closet$/ },
  { link: "Profile", heading: "Profile", url: /\/profile$/ },
  { link: "Should I buy this?", heading: "Should I buy this?", url: /\/check$/ },
];

test("nav reaches every section from home", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("link", { name: "fitcheck" })).toBeVisible();

  for (const { link, heading, url } of PAGES) {
    await nav.getByRole("link", { name: link, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("adding clothes starts from the closet", async ({ page }) => {
  await page.goto("/closet");
  await page.getByRole("main").getByRole("link", { name: "Add clothes" }).click();
  await expect(page).toHaveURL(/\/closet\/add$/);
  await expect(page.getByRole("heading", { name: "Add clothes" })).toBeVisible();
});
