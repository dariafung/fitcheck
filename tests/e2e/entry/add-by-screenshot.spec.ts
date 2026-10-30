import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { AiBudgetError } from "../../../lib/ai/errors";
import { aiErrorResponse } from "../../../lib/ai/http";
import { AI_BUDGET_NOTICE } from "../../../lib/ai/notices";
import { fakeScreenshot } from "../../../lib/entry/fake-screenshot";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";

const env = readLocalSupabase();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
// Items saved here, and images stored for drafts that were never saved.
const created: { id?: string; paths: string[] }[] = [];

test.beforeAll(async () => {
  // Saved items belong to the demo persona; make sure it exists without touching it.
  const persona = JSON.parse(readFileSync("seed/persona.json", "utf8"));
  await db.from("users").upsert(persona, { ignoreDuplicates: true }).throwOnError();
});

test.afterAll(async () => {
  for (const { id, paths } of created) {
    if (paths.length) await db.storage.from("item-images").remove(paths);
    if (id) await db.from("items").delete().eq("id", id);
  }
});

test("upload a screenshot, fix the details, save it", async ({ page }) => {
  await page.goto("/closet/add");
  await page.getByLabel("Choose a screenshot").setInputFiles({
    name: "wrap-dress.png",
    mimeType: "image/png",
    buffer: await fakeScreenshot(),
  });

  const card = page.getByRole("form", { name: "Item details" });
  await expect(card.getByRole("heading", { name: "Look right?" })).toBeVisible();
  await expect(card.getByLabel("Name")).toHaveValue("Mock item");
  await expect(card.getByRole("img", { name: "Mock item" })).toBeVisible();
  await expect(card.getByText("Photo is the whole screenshot")).toBeHidden();

  await card.getByLabel("Name").fill("Wrap Midi Dress");
  await card.getByLabel("Type").selectOption("one_piece");
  await expect(card.getByLabel("Main color")).toHaveValue("black");
  await card.getByLabel("Main color").selectOption("orange");
  await card.getByLabel("Colors").fill("Rust");
  // Size is optional and typed as it reads on the label.
  await expect(card.getByLabel("Size", { exact: true })).toHaveValue("");
  await card.getByLabel("Size", { exact: true }).fill("S");
  // Mock range for a top; make it a warm-weather piece.
  await expect(card.getByLabel("Lowest °F")).toHaveValue("50");
  await expect(card.getByLabel("Highest °F")).toHaveValue("85");
  await card.getByLabel("Lowest °F").fill("95");
  await expect(card.getByText("Low should be at or below high.")).toBeVisible();
  await expect(card.getByRole("button", { name: "Save to closet" })).toBeDisabled();
  await card.getByLabel("Lowest °F").fill("65");
  await card.getByLabel("Highest °F").fill("95");

  const saved = page.waitForResponse(
    (res) => res.url().endsWith("/api/items") && res.request().method() === "POST",
  );
  await card.getByRole("button", { name: "Save to closet" }).click();
  const res = await saved;
  expect(res.status()).toBe(201);
  const { item } = await res.json();

  await expect(page.getByRole("status")).toContainText("Wrap Midi Dress is in your closet.");
  await expect(card).toBeHidden();

  const { data: row } = await db.from("items").select("*").eq("id", item.id).single().throwOnError();
  created.push({ id: row.id, paths: row.image_paths });
  expect(row).toMatchObject({
    entry_method: "screenshot",
    title: "Wrap Midi Dress",
    category: "one_piece",
    size: "S",
    source_url: null,
    user_tags: {
      category: "one_piece",
      colorFamily: "orange",
      colors: [{ name: "Rust" }],
      tempRangeF: { min: 65, max: 95 },
    },
  });
  expect(row.image_paths).toHaveLength(1);

  await page.getByRole("button", { name: "Add another" }).click();
  await expect(page.getByLabel("Choose a screenshot")).toBeFocused();
});

test("a file that isn't a picture gets a short note", async ({ page }) => {
  await page.goto("/closet/add");
  await page.getByLabel("Choose a screenshot").setInputFiles({
    name: "notes.png",
    mimeType: "image/png",
    buffer: Buffer.from("not really a picture"),
  });
  await expect(page.getByRole("status")).toContainText("That file isn't a picture. Try a PNG or JPG.");
  await expect(page.getByRole("form", { name: "Item details" })).toBeHidden();
});

test("a wide screenshot is narrowed to 1600 px in the browser before upload", async ({ page }) => {
  await page.goto("/closet/add");
  const answered = page.waitForResponse((res) => res.url().endsWith("/api/items/extract"));
  await page.getByLabel("Choose a screenshot").setInputFiles({
    name: "desktop-page.png",
    mimeType: "image/png",
    buffer: await fakeScreenshot("#3f4a7a", { width: 2400, height: 6000 }),
  });
  // The server reports what it received.
  const { draft } = await (await answered).json();
  created.push({ paths: draft.imagePaths });
  expect(draft.rawSource.screenshot).toEqual({ width: 1600, height: 4000, mime: "image/jpeg" });
  await expect(page.getByRole("form", { name: "Item details" })).toBeVisible();
});

test("when the day's AI budget is spent, the page says so", async ({ page }) => {
  // Answer exactly as the route does, without calling the model.
  const spent = aiErrorResponse(new AiBudgetError("extractItem"));
  const body = await spent.text();
  await page.route("**/api/items/extract", (route) =>
    route.fulfill({ status: spent.status, contentType: "application/json", body }),
  );
  await page.goto("/closet/add");
  await page.getByLabel("Choose a screenshot").setInputFiles({
    name: "wrap-dress.png",
    mimeType: "image/png",
    buffer: await fakeScreenshot(),
  });
  await expect(page.getByRole("status")).toContainText(AI_BUDGET_NOTICE);
  await expect(page.getByRole("form", { name: "Item details" })).toBeHidden();
  await expect(page.getByLabel("Choose a screenshot")).toBeEnabled();
});
