import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { DEMO_USER_ID } from "../../../lib/db/current-user";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";

// A passing-on item's page: its size. Each test adds its own item.
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
      size: "M",
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

test("edit the size; one code can't read still saves, with a note", async ({ page }) => {
  await page.goto(`/closet/${item.id}`);
  await page.getByRole("button", { name: "Edit size" }).click();
  const size = page.getByLabel("What size is it?");
  await expect(size).toHaveValue("M");

  // A passing-on item can't lose its size.
  await size.fill("");
  await page.getByRole("button", { name: "Save size" }).click();
  await expect(page.getByText("Add a size first.")).toBeVisible();

  await size.fill("Large Tall");
  await page.getByRole("button", { name: "Save size" }).click();
  await expect(page.getByText("Size Large Tall")).toBeVisible();
  await expect(page.getByText("We can't read this size, so buyers aren't filtered by size.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Size Large Tall")).toBeVisible();
  const { data } = await db.from("items").select("size").eq("id", item.id).single();
  expect(data?.size).toBe("Large Tall");
});
