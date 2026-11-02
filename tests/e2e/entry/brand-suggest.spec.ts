import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { DEMO_USER_ID } from "../../../lib/db/current-user";
import { fakeScreenshot } from "../../../lib/entry/fake-screenshot";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";

const env = readLocalSupabase();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
// Items added here, and images stored for drafts.
const created: { id?: string; paths: string[] }[] = [];

test.beforeAll(async () => {
  const persona = JSON.parse(readFileSync("seed/persona.json", "utf8"));
  await db.from("users").upsert(persona, { ignoreDuplicates: true }).throwOnError();
});

test.afterAll(async () => {
  for (const { id, paths } of created) {
    if (paths.length) await db.storage.from("item-images").remove(paths);
    if (id) await db.from("items").delete().eq("id", id);
  }
});

test("the brand box suggests brands: keys, a click, or anything typed", async ({ page }) => {
  await page.goto("/closet/add");
  const extracted = page.waitForResponse((res) => res.url().endsWith("/api/items/extract"));
  await page.getByLabel("Choose a screenshot").setInputFiles({
    name: "tee.png",
    mimeType: "image/png",
    buffer: await fakeScreenshot(),
  });
  created.push({ paths: (await (await extracted).json()).draft.imagePaths });

  const card = page.getByRole("form", { name: "Item details" });
  const brand = card.getByRole("combobox", { name: "Brand" });
  const list = card.getByRole("listbox");
  await expect(brand).toHaveValue("lululemon");
  await expect(list).toBeHidden();

  // Keys: ↓ picks the first match, Enter fills it in without saving.
  await brand.fill("aber");
  await expect(list.getByRole("option")).toHaveText(["ABERCROMBIE & FITCH"]);
  await brand.press("ArrowDown");
  await expect(list.getByRole("option", { name: "ABERCROMBIE & FITCH" })).toHaveAttribute("aria-selected", "true");
  await brand.press("Enter");
  await expect(brand).toHaveValue("ABERCROMBIE & FITCH");
  await expect(list).toBeHidden();
  await expect(card.getByRole("heading", { name: "Look right?" })).toBeVisible();

  // Esc closes the list and keeps what's typed.
  await brand.fill("h");
  await expect(list.getByRole("option", { name: "H&M" })).toBeVisible();
  await brand.press("Escape");
  await expect(list).toBeHidden();
  await expect(brand).toHaveValue("h");

  // A click.
  await brand.fill("h &");
  await list.getByRole("option", { name: "H&M" }).click();
  await expect(brand).toHaveValue("H&M");
  await expect(list).toBeHidden();

  // Anything else is kept as typed.
  const own = `Tiny Studio ${randomUUID().slice(0, 6)}`;
  await brand.fill(own);
  await expect(list).toBeHidden();
  const saved = page.waitForResponse((res) => res.url().endsWith("/api/items") && res.request().method() === "POST");
  await card.getByRole("button", { name: "Save to closet" }).click();
  const { item } = await (await saved).json();
  created.push({ id: item.id, paths: [] });
  const { data: row } = await db.from("items").select("brand").eq("id", item.id).single().throwOnError();
  expect(row.brand).toBe(own);
});

test("editing an item suggests the user's own brands first", async ({ page }) => {
  const own = `Tiny Studio ${randomUUID().slice(0, 6)}`;
  // With a photo, like every item saved from the add page: buy.spec styles
  // the persona's outfits, which needs every piece to have one.
  const photo = `${DEMO_USER_ID}/${randomUUID()}.png`;
  created.push({ paths: [photo] });
  const upload = await db.storage
    .from("item-images")
    .upload(photo, await fakeScreenshot(), { contentType: "image/png" });
  if (upload.error) throw upload.error;
  const { data: item } = await db
    .from("items")
    .insert({
      user_id: DEMO_USER_ID,
      entry_method: "manual",
      title: `E2E brand tee ${randomUUID().slice(0, 8)}`,
      category: "top",
      image_paths: [photo],
      brand: own,
      ai_tags: { category: "top", colors: [{ name: "navy" }], materials: ["cotton"], formality: 2, occasions: ["social"] },
    })
    .select("id")
    .single()
    .throwOnError();
  created.push({ id: item.id, paths: [] });

  await page.goto(`/closet/${item.id}`);
  await page.getByRole("button", { name: "Edit details" }).click();
  const card = page.getByRole("form", { name: "Item details" });
  const brand = card.getByRole("combobox", { name: "Brand" });
  await expect(brand).toHaveValue(own);

  // The user's brands load when the box takes focus.
  const loaded = page.waitForResponse((res) => res.url().endsWith("/api/items/brands"));
  await brand.focus();
  await loaded;
  await brand.fill("t");
  const options = card.getByRole("listbox").getByRole("option");
  await expect(options.first()).toHaveText(own);
  await expect(options.filter({ hasText: "TOMMY HILFIGER" })).toBeVisible();
  await options.filter({ hasText: "TOMMY HILFIGER" }).click();
  await expect(brand).toHaveValue("TOMMY HILFIGER");
});
