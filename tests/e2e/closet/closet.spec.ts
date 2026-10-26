import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { DEMO_USER_ID } from "../../../lib/db/current-user";
import { FIXED_WEATHER } from "../../../lib/weather/today";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";

// Each test adds its own item to the seeded demo closet (`pnpm seed`) and
// removes it afterwards; seed rows are never written to.
const env = readLocalSupabase();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

let item: { id: string; title: string };

// The server runs with WEATHER_MODE=fixed, so today is FIXED_WEATHER. The
// test item is only comfortable in warmer weather than that.
const TOO_WARM = { min: FIXED_WEATHER.highF + 10, max: FIXED_WEATHER.highF + 35 };

test.beforeEach(async () => {
  const persona = await db.from("users").select("id").eq("id", DEMO_USER_ID).maybeSingle();
  if (!persona.data) throw new Error("Demo persona missing: run `pnpm seed` first.");

  const title = `E2E striped tee ${randomUUID().slice(0, 8)}`;
  const { data, error } = await db
    .from("items")
    .insert({
      user_id: DEMO_USER_ID,
      entry_method: "manual",
      title,
      category: "top",
      ai_tags: {
        category: "top",
        colors: [{ name: "navy" }],
        materials: ["cotton"],
        formality: 2,
        seasons: ["summer"],
        occasions: ["social"],
        tempRangeF: TOO_WARM,
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

test("open an item from the grid, write how it feels, and keep it", async ({ page }) => {
  await page.goto("/closet");
  await page.getByRole("link", { name: item.title }).click();
  await expect(page).toHaveURL(`/closet/${item.id}`);
  await expect(page.getByRole("heading", { level: 1, name: item.title })).toBeVisible();
  await expect(page.getByText("Cotton", { exact: true })).toBeVisible();

  const text = "Soft and easy. Love how it drapes.";
  const feeling = page.getByRole("region", { name: "How it feels" });
  await feeling.getByRole("textbox", { name: "How it feels" }).fill(text);
  await feeling.getByRole("button", { name: "Save" }).click();
  await expect(feeling.getByRole("status")).toHaveText("Saved");
  await expect(page.getByText(text)).toBeVisible();

  // Structured fields are filled after the response and never shown.
  await expect
    .poll(async () => {
      const { data } = await db.from("item_feelings").select("structured").eq("item_id", item.id);
      return data?.[0]?.structured;
    })
    .toMatchObject({ liked: "yes" });
  await expect(page.getByText("liked", { exact: false })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(text)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "How it feels" })).toHaveCount(0);
});

test("edit a saved feeling", async ({ page }) => {
  const { error } = await db.from("item_feelings").insert({
    item_id: item.id,
    user_id: DEMO_USER_ID,
    raw_text: "Fine, I guess.",
    source: "typed",
  });
  if (error) throw error;

  await page.goto(`/closet/${item.id}`);
  await expect(page.getByText("Fine, I guess.")).toBeVisible();
  const feeling = page.getByRole("region", { name: "How it feels" });
  await feeling.getByRole("button", { name: "Edit" }).click();
  const box = feeling.getByRole("textbox", { name: "How it feels" });
  await expect(box).toHaveValue("Fine, I guess.");
  await box.fill("Shrank in the wash. Too tight now.");
  await feeling.getByRole("button", { name: "Save" }).click();
  await expect(feeling.getByRole("status")).toHaveText("Saved");

  await page.reload();
  await expect(page.getByText("Shrank in the wash. Too tight now.")).toBeVisible();
  await expect(page.getByText("Fine, I guess.")).toHaveCount(0);
});

test("widening the temperature range moves an item into Good for today", async ({ page }) => {
  await page.goto("/closet");
  const good = page.getByRole("region", { name: "Good for today" });
  const notToday = page.getByRole("region", { name: "Not for today" });
  await expect(good).toContainText(`${FIXED_WEATHER.city} · ${FIXED_WEATHER.lowF}–${FIXED_WEATHER.highF}°F`);
  await expect(page.getByRole("link", { name: "Weather data by Open-Meteo.com" })).toBeVisible();
  await expect(notToday.getByRole("link", { name: item.title })).toBeVisible();

  await notToday.getByRole("link", { name: item.title }).click();
  await expect(page.getByText(`${TOO_WARM.min} to ${TOO_WARM.max}°F`)).toBeVisible();
  await page.getByRole("button", { name: "Edit temperature range" }).click();
  await page.getByRole("spinbutton", { name: "Lowest °F" }).fill(String(FIXED_WEATHER.lowF - 5));
  await page.getByRole("spinbutton", { name: "Highest °F" }).fill(String(FIXED_WEATHER.highF + 5));
  await page.getByRole("button", { name: "Save temperature range" }).click();
  await expect(page.getByText(`${FIXED_WEATHER.lowF - 5} to ${FIXED_WEATHER.highF + 5}°F`)).toBeVisible();

  await page.getByRole("link", { name: "← Closet" }).click();
  await expect(good.getByRole("link", { name: item.title })).toBeVisible();
  await expect(notToday.getByRole("link", { name: item.title })).toHaveCount(0);

  await page.reload();
  await expect(good.getByRole("link", { name: item.title })).toBeVisible();
});
