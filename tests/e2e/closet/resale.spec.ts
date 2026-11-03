import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { DEMO_USER_ID } from "../../../lib/db/current-user";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import seedItems from "../../../seed/items.json";
import { expect, test } from "../fixtures";

// A passing-on item's page: its size and who'd want it. The demo persona is
// only matched with the seed neighbors (pnpm seed), whose checks are seeded
// in the cache. Tests that change an item add their own.
const env = readLocalSupabase();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

let item: { id: string; title: string };

test.beforeEach(async () => {
  const title = `E2E denim jacket ${randomUUID().slice(0, 8)}`;
  const { data, error } = await db
    .from("items")
    .insert({
      user_id: DEMO_USER_ID,
      entry_method: "manual",
      title,
      category: "outerwear",
      status: "passing_on",
      // Bigger than any seed neighbor.
      size: "XXL",
      asking_price_cents: 3000,
      condition: "good",
      ai_tags: {
        category: "outerwear",
        colors: [{ name: "indigo" }],
        materials: ["denim"],
        formality: 2,
        occasions: ["social"],
      },
    })
    .select("id")
    .single();
  if (error) throw error;
  item = { id: data.id, title };
});

test.afterEach(async () => {
  await db.from("items").delete().eq("id", item.id);
});

test("a passing-on item shows its size and listing, and says when no buyer fits it", async ({ page }) => {
  await page.goto(`/closet/${item.id}`);
  await expect(page.getByText("Size XXL")).toBeVisible();
  await expect(page.getByText("Asking $30 · Good")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Matching buyers" })).toBeVisible();
  await expect(page.getByText("No buyers for this one right now.")).toBeVisible();
});

test("the persona's baby tee and shorts show the seeded buyer counts, as anonymous avatars", async ({ page }) => {
  for (const { title, count } of [
    { title: "100% Cotton Crew Baby Tee", count: 3 },
    { title: "Fleece Shortie Shorts", count: 2 },
  ]) {
    const piece = seedItems.find((i) => i.title === title)!;
    await page.goto(`/closet/${piece.id}`);
    const buyers = page.getByRole("region", { name: "Matching buyers" });
    await expect(buyers.getByText(`${count} people would likely want this.`)).toBeVisible();
    // One plain avatar per match, and no scores.
    await expect(buyers.getByRole("img", { name: "Anonymous buyer" })).toHaveCount(count);
    await expect(buyers).not.toContainText(/match\b/);
    // No buyer's name, ever.
    await expect(buyers).not.toContainText(/Maya|Jordan|Priya|Lena/);
  }
});

test("edit the size and listing; a size code can't read still saves, with a note", async ({ page }) => {
  await page.goto(`/closet/${item.id}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const size = page.getByLabel("Size", { exact: true });
  await expect(size).toHaveValue("XXL");
  await expect(page.getByLabel("Price (USD)")).toHaveValue("30");
  await expect(page.getByLabel("Condition")).toHaveValue("good");

  // A passing-on item can't lose its size.
  await size.fill("");
  await page.getByRole("button", { name: "Save listing" }).click();
  await expect(page.getByText("Add a size first.")).toBeVisible();

  await size.fill("Large Tall");
  await page.getByLabel("Price (USD)").fill("$22");
  await page.getByLabel("Condition").selectOption("Fair");
  await page.getByRole("button", { name: "Save listing" }).click();
  await expect(page.getByText("Size Large Tall")).toBeVisible();
  await expect(page.getByText("Asking $22 · Fair")).toBeVisible();
  await expect(page.getByText("We can't read this size, so buyers aren't filtered by size.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Size Large Tall")).toBeVisible();
  const { data } = await db.from("items").select("size, asking_price_cents, condition").eq("id", item.id).single();
  expect(data).toEqual({ size: "Large Tall", asking_price_cents: 2200, condition: "fair" });
});
