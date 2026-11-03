import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { DEMO_USER_ID } from "../../../lib/db/current-user";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import seedItems from "../../../seed/items.json";
import { expect, test } from "../fixtures";

// A passing-on item's page: its size and who'd want it. The demo persona is
// only matched with the seeded sample buyers (pnpm seed), checked here with
// the mock models. Tests that change an item add their own.
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
      // Bigger than any sample buyer.
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

test("the persona's baby tee has one strong sample buyer, shown as one avatar", async ({ page }) => {
  const tee = seedItems.find((i) => i.title === "100% Cotton Crew Baby Tee")!;
  await page.goto(`/closet/${tee.id}`);
  const buyers = page.getByRole("region", { name: "Matching buyers" });
  await expect(buyers.getByText("1 person would likely want this.")).toBeVisible();
  await expect(buyers.getByText("Sample buyers for the demo.")).toBeVisible();
  // One plain avatar per match, and no scores.
  await expect(buyers.getByRole("img", { name: "Anonymous buyer" })).toHaveCount(1);
  await expect(buyers).not.toContainText(/match\b/);
  // No sample buyer's name ("Sample buyer Maya").
  await expect(buyers).not.toContainText(/Sample buyer [A-Z]/);
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
