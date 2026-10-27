import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fakeScreenshot } from "../../../lib/entry/fake-screenshot";
import { CANDIDATE_ITEM_ID } from "../../../lib/check/pairings";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";

const env = readLocalSupabase();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const persona = JSON.parse(readFileSync("seed/persona.json", "utf8"));

// By title: other specs may add items to the persona at the same time.
async function itemsTitled(title: string) {
  const { data } = await db
    .from("items")
    .select("id")
    .eq("user_id", persona.id)
    .eq("title", title)
    .throwOnError();
  return data;
}

test.beforeAll(async () => {
  // Checks run against the demo persona's closet; make sure it exists without touching it.
  await db.from("users").upsert(persona, { ignoreDuplicates: true }).throwOnError();
});

async function upload(page: import("@playwright/test").Page) {
  await page.getByLabel("Choose a screenshot").setInputFiles({
    name: "loafers.png",
    mimeType: "image/png",
    buffer: await fakeScreenshot(),
  });
  const card = page.getByRole("form", { name: "Item details" });
  await expect(card.getByLabel("Name")).toHaveValue("Mock item");
  return card;
}

test("check an item: screenshot, confirm, score, check another", async ({ page }) => {
  await page.goto("/check");
  const card = await upload(page);
  await expect(card.getByRole("img", { name: "Mock item" })).toBeVisible();
  await expect(card.getByText("Fix anything that's off, then check.")).toBeVisible();
  await card.getByLabel("Name").fill("Black loafers");
  await card.getByLabel("Type").selectOption("shoes");

  await card.getByRole("button", { name: "Check it" }).click();
  const result = page.getByRole("region", { name: "Result" });
  await expect(result.getByRole("heading", { name: "Black loafers" })).toBeVisible();
  await expect(result.getByTestId("score")).toHaveText(/^\d{1,3}$/);
  for (const part of ["Suits you", "Outfits", "Revives", "Fills a gap", "Not a repeat"]) {
    await expect(result.getByText(part, { exact: true })).toBeVisible();
  }

  // Nothing about the item was kept.
  expect(await itemsTitled("Black loafers")).toEqual([]);
  const { data: pairs } = await db
    .from("pairings")
    .select("id")
    .or(`item_a_id.eq.${CANDIDATE_ITEM_ID},item_b_id.eq.${CANDIDATE_ITEM_ID}`)
    .throwOnError();
  expect(pairs).toEqual([]);

  await result.getByRole("button", { name: "Check another" }).click();
  await expect(result).toBeHidden();
  await expect(page.getByLabel("Choose a screenshot")).toBeEnabled();
});

test("accessories aren't scored yet", async ({ page }) => {
  await page.goto("/check");
  const card = await upload(page);
  await card.getByLabel("Type").selectOption("accessory");
  await card.getByRole("button", { name: "Check it" }).click();
  await expect(page.getByRole("status")).toContainText("Accessories aren't supported yet");
  await expect(page.getByRole("region", { name: "Result" })).toBeHidden();

  await page.getByRole("button", { name: "Use another screenshot" }).click();
  await expect(card).toBeHidden();
  await expect(page.getByLabel("Choose a screenshot")).toBeEnabled();
});
