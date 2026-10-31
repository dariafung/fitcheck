import { readFileSync } from "node:fs";
import { expect, test } from "../fixtures";

// One row per topic the seeded card speaks to; colors always come first.
const seedCard = JSON.parse(readFileSync("seed/style-profile.json", "utf8")) as {
  suits: { topic: string }[];
  avoid: { topic: string }[];
};
const TOPICS = new Set([...seedCard.suits, ...seedCard.avoid].map((s) => s.topic));

// Sign-in off: the current user is the persona, whose style card comes from
// the seed (`pnpm seed`) and is never rebuilt, so this only reads.
test("home shows the persona's style card and never asks to rebuild it", async ({ page }) => {
  const rebuilds: string[] = [];
  page.on("request", (req) => {
    if (req.url().endsWith("/api/style-profile")) rebuilds.push(req.method());
  });

  await page.goto("/");
  const card = page.getByRole("region", { name: "Your style" });
  await expect(card).toBeVisible();
  await expect(card.getByText(/^Updated /)).toBeVisible();
  await expect(card.getByRole("term")).toHaveCount(TOPICS.size);
  if (TOPICS.has("color")) await expect(card.getByRole("term").first()).toHaveText("Colors");
  // Sources stay in the backend.
  await expect(card.getByRole("link")).toHaveCount(0);

  await page.reload();
  await expect(card).toBeVisible();
  expect(rebuilds).toEqual([]);
});
