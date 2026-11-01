import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { fakeScreenshot } from "../../../lib/entry/fake-screenshot";
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
// Extra rows a test adds; removed with the item.
let extraIds: string[] = [];
// Photos a test uploads; removed with the item.
let imagePaths: string[] = [];

// The server runs with WEATHER_MODE=fixed, so today is FIXED_WEATHER. The
// test item is only comfortable in warmer weather than that.
const TOO_WARM = { min: FIXED_WEATHER.highF + 10, max: FIXED_WEATHER.highF + 35 };

test.beforeEach(async () => {
  const persona = await db.from("users").select("id").eq("id", DEMO_USER_ID).maybeSingle();
  if (!persona.data) throw new Error("Demo persona missing: run `pnpm seed` first.");

  // With a photo, like every item saved from the add page: buy.spec styles
  // the persona's outfits, which needs every piece to have one.
  const photo = `${DEMO_USER_ID}/${randomUUID()}.webp`;
  imagePaths.push(photo);
  const webp = await sharp(await fakeScreenshot()).webp().toBuffer();
  const upload = await db.storage.from("item-images").upload(photo, webp, { contentType: "image/webp" });
  if (upload.error) throw upload.error;

  const title = `E2E striped tee ${randomUUID().slice(0, 8)}`;
  const { data, error } = await db
    .from("items")
    .insert({
      user_id: DEMO_USER_ID,
      entry_method: "manual",
      title,
      category: "top",
      image_paths: [photo],
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
  await db.from("items").delete().in("id", [item.id, ...extraIds]);
  if (imagePaths.length) await db.storage.from("item-images").remove(imagePaths);
  extraIds = [];
  imagePaths = [];
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

test("an item page shows the closet pieces it goes with, from cached pairings only", async ({ page }) => {
  await page.goto(`/closet/${item.id}`);
  // Nothing judged for a new piece yet, and opening the page judges nothing.
  await expect(page.getByText("Not paired with your closet yet.")).toBeVisible();
  const { data: judged } = await db.from("pairings").select("id").or(`item_a_id.eq.${item.id},item_b_id.eq.${item.id}`);
  expect(judged).toEqual([]);

  const { data: jeans } = await db
    .from("items")
    .select("id, title")
    .eq("user_id", DEMO_USER_ID)
    .eq("status", "active")
    .eq("category", "bottom")
    .limit(1)
    .single()
    .throwOnError();
  const [a, b] = item.id < jeans.id ? [item.id, jeans.id] : [jeans.id, item.id];
  await db
    .from("pairings")
    .insert({ user_id: DEMO_USER_ID, item_a_id: a, item_b_id: b, pairs: true, source: "ai", prompt_version: "e2e" })
    .throwOnError();

  await page.reload();
  const goes = page.getByRole("region", { name: "Goes with 1 piece in your closet" });
  await expect(goes).toBeVisible();
  await goes.getByRole("link", { name: jeans.title }).click();
  await expect(page).toHaveURL(`/closet/${jeans.id}`);
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
  await feeling.getByRole("button", { name: "Edit note" }).click();
  const box = feeling.getByRole("textbox", { name: "How it feels" });
  await expect(box).toHaveValue("Fine, I guess.");
  await box.fill("Shrank in the wash. Too tight now.");
  await feeling.getByRole("button", { name: "Save" }).click();
  await expect(feeling.getByRole("status")).toHaveText("Saved");

  await page.reload();
  await expect(page.getByText("Shrank in the wash. Too tight now.")).toBeVisible();
  await expect(page.getByText("Fine, I guess.")).toHaveCount(0);
});

test("edit details: a wider temperature range moves an item into Good for today on home", async ({ page }) => {
  await page.goto("/");
  const good = page.getByRole("region", { name: "Good for today" });
  await expect(good).toContainText(`${FIXED_WEATHER.city} · ${FIXED_WEATHER.lowF}–${FIXED_WEATHER.highF}°F`);
  await expect(page.getByRole("link", { name: "Weather data by Open-Meteo.com" })).toBeVisible();
  await expect(good.getByRole("link", { name: item.title })).toHaveCount(0);

  await good.getByRole("link", { name: "See all clothes" }).click();
  await expect(page).toHaveURL(/\/closet$/);
  await page.getByRole("link", { name: item.title }).click();
  await expect(page.getByText(`${TOO_WARM.min}–${TOO_WARM.max}°F`)).toBeVisible();
  await page.getByRole("button", { name: "Edit details" }).click();
  const card = page.getByRole("form", { name: "Item details" });
  await expect(card.getByRole("heading", { name: "Edit details" })).toBeVisible();
  await expect(card.getByLabel("Name")).toHaveValue(item.title);
  await expect(card.getByRole("spinbutton", { name: "Lowest °F" })).toHaveValue(String(TOO_WARM.min));
  await card.getByRole("spinbutton", { name: "Lowest °F" }).fill(String(FIXED_WEATHER.lowF - 5));
  await card.getByRole("spinbutton", { name: "Highest °F" }).fill(String(FIXED_WEATHER.highF + 5));
  await card.getByLabel("How dressy").selectOption({ label: "Business" });
  await card.getByRole("button", { name: "Save changes" }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await expect(page.getByText(`${FIXED_WEATHER.lowF - 5}–${FIXED_WEATHER.highF + 5}°F`)).toBeVisible();
  await expect(page.getByText("Business", { exact: true })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "fitcheck" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(good.getByRole("link", { name: item.title })).toBeVisible();

  await page.reload();
  await expect(good.getByRole("link", { name: item.title })).toBeVisible();
});

test("closet tabs: Wearing shows what you wear, Passing on survives a refresh", async ({ page }) => {
  const passing = `E2E old dress ${randomUUID().slice(0, 8)}`;
  const { data, error } = await db
    .from("items")
    .insert({ user_id: DEMO_USER_ID, entry_method: "manual", title: passing, category: "one_piece", status: "passing_on" })
    .select("id")
    .single();
  if (error) throw error;
  extraIds.push(data.id);

  await page.goto("/closet");
  const main = page.getByRole("main");
  const wearingTab = main.getByRole("link", { name: /^Wearing \d+$/ });
  const passingTab = main.getByRole("link", { name: /^Passing on \d+$/ });
  await expect(wearingTab).toHaveAttribute("aria-current", "page");
  await expect(main.getByRole("link", { name: item.title })).toBeVisible();
  await expect(main.getByRole("link", { name: passing })).toHaveCount(0);

  await passingTab.click();
  await expect(page).toHaveURL(/\/closet\?tab=passing-on$/);
  await expect(passingTab).toHaveAttribute("aria-current", "page");
  await expect(main.getByRole("link", { name: passing })).toBeVisible();
  await expect(main.getByRole("link", { name: item.title })).toHaveCount(0);

  await page.reload();
  await expect(passingTab).toHaveAttribute("aria-current", "page");
  await expect(main.getByRole("link", { name: passing })).toBeVisible();

  await wearingTab.click();
  await expect(page).toHaveURL(/\/closet$/);
  await expect(main.getByRole("link", { name: item.title })).toBeVisible();
});

test("closet categories: filter by type, keep the tab, and show all again when empty", async ({ page }) => {
  const passing = `E2E old dress ${randomUUID().slice(0, 8)}`;
  const { data, error } = await db
    .from("items")
    .insert({ user_id: DEMO_USER_ID, entry_method: "manual", title: passing, category: "one_piece", status: "passing_on" })
    .select("id")
    .single();
  if (error) throw error;
  extraIds.push(data.id);

  await page.goto("/closet");
  const main = page.getByRole("main");
  const categories = main.getByRole("group", { name: "Category" });
  await expect(categories.getByRole("link", { name: /^All \d+$/ })).toHaveAttribute("aria-current", "true");
  // The persona owns no one-piece, so with this one in Passing on, Wearing does not offer it.
  await expect(categories.getByRole("link", { name: /^One-piece/ })).toHaveCount(0);

  await categories.getByRole("link", { name: /^Top \d+$/ }).click();
  await expect(page).toHaveURL(/\/closet\?cat=top$/);
  await expect(categories.getByRole("link", { name: /^Top \d+$/ })).toHaveAttribute("aria-current", "true");
  await expect(main.getByRole("link", { name: item.title })).toBeVisible();
  await expect(main.getByRole("list").getByText("Bottom", { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(main.getByRole("link", { name: item.title })).toBeVisible();

  // The tab keeps the category: no shoes are on their way out.
  await categories.getByRole("link", { name: /^Shoes \d+$/ }).click();
  await main.getByRole("link", { name: /^Passing on 0$/ }).click();
  await expect(page).toHaveURL(/\/closet\?tab=passing-on&cat=shoes$/);
  await expect(page.getByText("Nothing in this category.")).toBeVisible();
  await expect(main.getByRole("link", { name: passing })).toHaveCount(0);

  await main.getByRole("link", { name: "Show all" }).click();
  await expect(page).toHaveURL(/\/closet\?tab=passing-on$/);
  await expect(main.getByRole("link", { name: passing })).toBeVisible();
  await expect(categories.getByRole("link", { name: /^One-piece 1$/ })).toBeVisible();
});

test("pass an item on from its page, then keep wearing it", async ({ page }) => {
  await page.goto(`/closet/${item.id}`);
  // It has no size yet, so it asks for one first.
  await page.getByRole("button", { name: "Pass it on" }).click();
  const size = page.getByLabel("What size is it?");
  await page.getByRole("button", { name: "Pass it on" }).click();
  await expect(page.getByText("Add a size first.")).toBeVisible();
  await size.fill("M");
  await page.getByRole("button", { name: "Pass it on" }).click();
  await expect(page.getByText("Passing on. It's left out of your outfits and buy checks.")).toBeVisible();
  await expect(page.getByText("Size M")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pass it on" })).toHaveCount(0);

  const main = page.getByRole("main");
  await page.goto("/closet?tab=passing-on");
  await expect(main.getByRole("link", { name: item.title })).toBeVisible();
  await page.goto("/closet");
  await expect(main.getByRole("link", { name: item.title })).toHaveCount(0);

  await page.goto(`/closet/${item.id}`);
  await page.getByRole("button", { name: "Keep wearing it" }).click();
  await expect(page.getByRole("button", { name: "Pass it on" })).toBeVisible();
  await expect(page.getByText("Passing on. It's left out of your outfits and buy checks.")).toHaveCount(0);
  await page.goto("/closet");
  await expect(main.getByRole("link", { name: item.title })).toBeVisible();

  // The size stays, so passing it on again is one tap.
  await page.goto(`/closet/${item.id}`);
  await page.getByRole("button", { name: "Pass it on" }).click();
  await expect(page.getByText("Size M")).toBeVisible();
});

// Only this file adds passing-on items, and its tests run one at a time.
// (An empty Passing on is checked with a new account in auth/auth.spec.ts.)
test("Passing on shows only the persona's pieces on their way out", async ({ page }) => {
  const seeded = (JSON.parse(readFileSync("seed/items.json", "utf8")) as { title: string; status: string }[])
    .filter((i) => i.status === "passing_on")
    .map((i) => i.title);
  await page.goto("/closet?tab=passing-on");
  const main = page.getByRole("main");
  for (const title of seeded) await expect(main.getByRole("link", { name: title })).toBeVisible();
  await expect(main.getByRole("link", { name: item.title })).toHaveCount(0);
});

test("delete an item: confirm first, then it's gone from home, the closet and storage", async ({ page }) => {
  const photo = `${DEMO_USER_ID}/${randomUUID()}.webp`;
  imagePaths.push(photo);
  const webp = await sharp(await fakeScreenshot()).webp().toBuffer();
  const upload = await db.storage.from("item-images").upload(photo, webp, { contentType: "image/webp" });
  if (upload.error) throw upload.error;
  const comfy = { min: FIXED_WEATHER.lowF, max: FIXED_WEATHER.highF };
  const { error } = await db
    .from("items")
    .update({ image_paths: [photo], user_tags: { tempRangeF: comfy } })
    .eq("id", item.id);
  if (error) throw error;

  await page.goto("/");
  const good = page.getByRole("region", { name: "Good for today" });
  await good.getByRole("link", { name: item.title }).click();
  await expect(page).toHaveURL(`/closet/${item.id}`);

  await page.getByRole("button", { name: "Delete this item" }).click();
  await expect(page.getByText("Delete this for good?")).toBeVisible();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByText("Delete this for good?")).toHaveCount(0);

  await page.getByRole("button", { name: "Delete this item" }).click();
  await page.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(page).toHaveURL(/\/closet$/);
  await expect(page.getByRole("main").getByRole("link", { name: /^Wearing \d+$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: item.title })).toHaveCount(0);

  await page.goto("/");
  await expect(good).toBeVisible();
  await expect(good.getByRole("link", { name: item.title })).toHaveCount(0);

  const { data: rows } = await db.from("items").select("id").eq("id", item.id);
  expect(rows).toEqual([]);
  const { data: files } = await db.storage.from("item-images").list(DEMO_USER_ID, { search: photo.split("/")[1] });
  expect(files).toEqual([]);
});
