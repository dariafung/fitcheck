import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { DEMO_USER_ID } from "../../../lib/db/current-user";
import { fakeScreenshot } from "../../../lib/entry/fake-screenshot";
import { toUnit } from "../../../lib/profile/temp-unit";
import { FIXED_WEATHER } from "../../../lib/weather/today";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";

// The app only has the demo persona, so these tests blank its profile to act
// as a new user and put the original back afterwards. playwright.config.ts
// runs this file after every other spec, which may read the persona.
const env = readLocalSupabase();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const COLUMNS =
  "height_cm, weight_kg, bust_cm, waist_cm, hip_cm, inseam_cm, body_shape, lifestyle_mix, top_size, bottom_size, shoe_size, temp_unit, resale_opt_in";
const BLANK = {
  height_cm: null,
  weight_kg: null,
  bust_cm: null,
  waist_cm: null,
  hip_cm: null,
  inseam_cm: null,
  body_shape: null,
  lifestyle_mix: { work: 0, school: 0, social: 0, sport: 0, home: 0 },
  top_size: null,
  bottom_size: null,
  shoe_size: null,
  temp_unit: null,
  resale_opt_in: false,
};

let original: Record<string, unknown>;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data, error } = await db.from("users").select(COLUMNS).eq("id", DEMO_USER_ID).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Demo persona missing: run `pnpm seed` first.");
  original = data;
});

test.beforeEach(async () => {
  await db.from("users").update(BLANK).eq("id", DEMO_USER_ID).throwOnError();
});

test.afterAll(async () => {
  await db.from("users").update(original).eq("id", DEMO_USER_ID).throwOnError();
});

async function savedProfile() {
  const { data } = await db.from("users").select(COLUMNS).eq("id", DEMO_USER_ID).single();
  return data;
}

test("a new user fills in their profile in in / lb and it sticks", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();

  const height = page.getByLabel("Height", { exact: true });
  const weight = page.getByLabel("Weight", { exact: true });
  await expect(height).toHaveValue("");

  // Nothing is saved until height, weight, body shape and sizes are in.
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Add your height.")).toBeVisible();
  await expect(page.getByText("Add your weight.")).toBeVisible();
  await expect(page.getByText("Pick one.")).toBeVisible();
  await expect(page.getByText("Pick a size.")).toHaveCount(3);
  await expect(page.getByText("Pick °F or °C.")).toBeVisible();

  await height.fill("65");
  await expect(page.getByText("5 ft 5 in")).toBeVisible();
  await weight.fill("128");
  await page.getByLabel("Hips", { exact: true }).fill("37");
  await page.locator("label", { hasText: /^Pear$/ }).click();
  await expect(page.getByRole("radio", { name: "Pear" })).toBeChecked();
  await page.getByLabel("Tops & dresses").selectOption("M");
  await page.getByLabel("Bottoms").selectOption("S");
  await page.getByLabel("Shoes").selectOption({ label: "Women's 7.5" });
  await page.getByLabel("School", { exact: true }).fill("4");
  await page.getByLabel("Social", { exact: true }).fill("2");
  await page.getByRole("group", { name: "Temperature" }).getByRole("button", { name: "°F" }).click();
  await page.getByRole("checkbox", { name: "Match me with secondhand pieces" }).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await expect(page.getByText("Add your height.")).toHaveCount(0);
  await expect(page.getByText("Pick a size.")).toHaveCount(0);

  const saved = await savedProfile();
  expect(saved).toMatchObject({
    body_shape: "pear",
    bust_cm: null,
    lifestyle_mix: { work: 0, school: 4, social: 2, sport: 0, home: 0 },
    top_size: "M",
    bottom_size: "S",
    shoe_size: "W7.5",
    temp_unit: "F",
    resale_opt_in: true,
  });
  expect(saved?.height_cm).toBeCloseTo(165.1, 1);
  expect(saved?.weight_kg).toBeCloseTo(58.1, 1);
  expect(saved?.hip_cm).toBeCloseTo(94, 0);

  await page.reload();
  await expect(height).toHaveValue("65");
  await expect(weight).toHaveValue("128");
  await expect(page.getByLabel("School", { exact: true })).toHaveValue("4");
  await expect(page.getByRole("radio", { name: "Pear" })).toBeChecked();
  await expect(page.getByLabel("Shoes")).toHaveValue("W7.5");
  await expect(page.getByRole("checkbox", { name: "Match me with secondhand pieces" })).toBeChecked();
});

test("units switch to cm / kg and stay that way after a refresh", async ({ page }) => {
  await db.from("users").update({ height_cm: 165, weight_kg: 58 }).eq("id", DEMO_USER_ID).throwOnError();
  await page.goto("/profile");
  const height = page.getByLabel("Height", { exact: true });
  await expect(height).toHaveValue("65");

  const units = page.getByRole("group", { name: "Units" });
  await units.getByRole("button", { name: "cm · kg" }).click();
  await expect(height).toHaveValue("165");
  await expect(page.getByLabel("Weight", { exact: true })).toHaveValue("58");

  await page.reload();
  await expect(height).toHaveValue("165");
  await expect(units.getByRole("button", { name: "cm · kg" })).toHaveAttribute("aria-pressed", "true");

  await units.getByRole("button", { name: "in · lb" }).click();
  await expect(height).toHaveValue("65");
});

test("outfit counts over 30 are not saved", async ({ page }) => {
  await page.goto("/profile");
  await page.getByLabel("Height", { exact: true }).fill("65");
  await page.getByLabel("Weight", { exact: true }).fill("128");
  await page.locator("label", { hasText: /^Apple$/ }).click();
  await page.getByLabel("Work", { exact: true }).fill("31");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("0 to 30.")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  expect((await savedProfile())?.height_cm).toBeNull();
});

test("after picking °C, home, the item page and its editor all use °C and save °F", async ({ page }) => {
  // A filled-in profile from before units were asked: only the unit is missing.
  await db
    .from("users")
    .update({ height_cm: 165, weight_kg: 58, body_shape: "pear", top_size: "S", bottom_size: "S", shoe_size: "W7.5" })
    .eq("id", DEMO_USER_ID)
    .throwOnError();
  // 51°F shows as 11°C, which would save as 52°F if converted back.
  const title = `E2E unit tee ${randomUUID().slice(0, 8)}`;
  const { data: item } = await db
    .from("items")
    .insert({
      user_id: DEMO_USER_ID,
      entry_method: "manual",
      title,
      category: "top",
      ai_tags: { category: "top", colors: [], materials: [], formality: 2, occasions: [], tempRangeF: { min: 51, max: 70 } },
    })
    .select("id")
    .single()
    .throwOnError();

  try {
    await page.goto("/profile");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Pick °F or °C.")).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    await page.getByRole("group", { name: "Temperature" }).getByRole("button", { name: "°C" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved");
    expect((await savedProfile())?.temp_unit).toBe("C");

    await page.goto("/");
    const today = `${toUnit(FIXED_WEATHER.lowF, "C")}–${toUnit(FIXED_WEATHER.highF, "C")}°C`;
    await expect(page.getByRole("region", { name: "Good for today" })).toContainText(today);

    await page.goto(`/closet/${item.id}`);
    await expect(page.getByText("11–21°C")).toBeVisible();
    await page.getByRole("button", { name: "Edit details" }).click();
    const card = page.getByRole("form", { name: "Item details" });
    await expect(card.getByRole("spinbutton", { name: "Lowest °C" })).toHaveValue("11");
    await card.getByRole("spinbutton", { name: "Highest °C" }).fill("25");
    await card.getByRole("button", { name: "Save changes" }).click();
    await expect(card).toHaveCount(0);
    await expect(page.getByText("11–25°C")).toBeVisible();

    // The untouched low keeps its exact °F; the typed high is converted.
    const { data } = await db.from("items").select("user_tags").eq("id", item.id).single().throwOnError();
    expect((data.user_tags as { tempRangeF: unknown }).tempRangeF).toEqual({ min: 51, max: 77 });

    // The purchase check's card too (it stores nothing).
    await page.goto("/check");
    await page.getByLabel("Choose a screenshot").setInputFiles({
      name: "tee.png",
      mimeType: "image/png",
      buffer: await fakeScreenshot(),
    });
    const draft = page.getByRole("form", { name: "Item details" });
    await expect(draft.getByRole("spinbutton", { name: "Lowest °C" })).toBeVisible();
  } finally {
    await db.from("items").delete().eq("id", item.id);
  }
});
