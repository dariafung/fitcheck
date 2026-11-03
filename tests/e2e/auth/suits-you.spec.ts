import neighbors from "../../../seed/neighbors.json";
import resaleMatches from "../../../seed/resale-matches.json";
import { listingText } from "../../../lib/resale/listing";
import { sizeLabel } from "../../../lib/resale/size";
import { expect, test } from "../fixtures";
import type { Page } from "@playwright/test";

// The demo account's home with sign-in on: "Suits you" lists what the seed
// neighbors pass on, from the seeded cached checks (pnpm seed). Only read.
async function tryDemo(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo account" }).click();
  await expect(page).toHaveURL("/");
}

test("Suits you shows the neighbors' pieces with their listing, reasons and seller's name only", async ({ page }) => {
  await tryDemo(page);
  const suits = page.getByRole("region", { name: "Suits you" });
  for (const piece of neighbors.items) {
    const card = suits.getByRole("listitem").filter({ hasText: piece.title });
    const seller = neighbors.users.find((u) => u.id === piece.user_id)!;
    const match = resaleMatches.matches.find((m) => m.item_id === piece.id)!;
    await expect(card.getByText(`from ${seller.display_name}`)).toBeVisible();
    await expect(card.getByText(`${sizeLabel(piece.size)} · ${listingText(piece.asking_price_cents, piece.condition)}`)).toBeVisible();
    await expect(card.getByText(match.buyer_reasons[0])).toBeVisible();
  }
  // Look only: no email, no score, nothing to press.
  await expect(suits).not.toContainText(/@|\b\d+ ?%|score/i);
  await expect(suits.getByRole("button")).toHaveCount(0);
  await expect(suits.getByRole("link")).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Suits you fits the screen", async ({ page }) => {
    await tryDemo(page);
    await expect(page.getByRole("region", { name: "Suits you" }).getByText(neighbors.items[0].title)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
