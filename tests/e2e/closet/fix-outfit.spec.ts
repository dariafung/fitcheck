import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { fakeScreenshot } from "../../../lib/entry/fake-screenshot";
import { DEMO_USER_ID } from "../../../lib/db/current-user";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";

// Sign-in off: the current user is the persona, whose fix outfits come from
// the seed (`pnpm seed`) and are never asked of the model. The persona can
// save here; the outfits this spec saves are removed afterwards.
const env = readLocalSupabase();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const seedFixes = JSON.parse(readFileSync("seed/fix-outfits.json", "utf8")) as {
  item_id: string;
  outfit_item_ids: string[] | null;
  reason: string | null;
}[];
const seedFeelings = JSON.parse(readFileSync("seed/feelings.json", "utf8")) as {
  item_id: string;
  structured: { aspects: { sentiment: string }[] };
}[];
const seedItems = JSON.parse(readFileSync("seed/items.json", "utf8")) as { id: string; status: string; rating?: number }[];
const complains = (id: string) => seedFeelings.find((f) => f.item_id === id)?.structured.aspects.some((a) => a.sentiment === "negative") ?? false;
const ratingOf = (id: string) => seedItems.find((i) => i.id === id)?.rating ?? null;
// A three-piece suggestion for a written complaint, so the other two pieces' pages can be checked.
const suggested = seedFixes.find((f) => f.outfit_item_ids?.length === 3 && complains(f.item_id))!;
// Rated 1 or 2 with nothing bad written about it.
const lowRated = seedFixes.find((f) => f.outfit_item_ids !== null && !complains(f.item_id))!;
const nothingHelps = seedFixes.find((f) => f.outfit_item_ids === null)!;
// A piece of the suggested outfit that is neither complained about nor rated low.
const happyPiece = suggested.outfit_item_ids!.find((id) => id !== suggested.item_id && !complains(id) && (ratingOf(id) ?? 5) > 2)!;

async function clearSaved() {
  const { error } = await db.from("saved_outfits").delete().eq("user_id", DEMO_USER_ID);
  if (error) throw error;
}

test.beforeEach(clearSaved);
test.afterEach(clearSaved);

test("a piece with a complaint gets an outfit that fixes it, which can be saved and removed", async ({ page }) => {
  await page.goto(`/closet/${suggested.item_id}`);
  const fix = page.getByRole("region", { name: "Try it like this" });
  await expect(fix).toBeVisible();
  await expect(fix.getByTestId("outfit-board").getByRole("listitem")).toHaveCount(3);
  await expect(fix.getByTestId("fix-reason")).toHaveText(suggested.reason!);
  await expect(page.getByRole("region", { name: "Saved outfits" })).toHaveCount(0);

  await fix.getByRole("button", { name: "Save outfit" }).click();
  await expect(fix.getByRole("status")).toHaveText("Saved");
  await expect(fix.getByRole("button", { name: "Save outfit" })).toHaveCount(0);

  // Still saved after a reload, and not listed a second time under it.
  await page.reload();
  await expect(fix.getByRole("status")).toHaveText("Saved");
  await expect(page.getByRole("region", { name: "Saved outfits" })).toHaveCount(0);

  // The outfit belongs to every piece in it: another piece's page lists it,
  // and that piece, with nothing bad said about it, gets no suggestion.
  await page.goto(`/closet/${happyPiece}`);
  const saved = page.getByRole("region", { name: "Saved outfits" });
  await expect(saved.getByTestId("saved-outfit")).toHaveCount(1);
  await expect(saved.getByTestId("outfit-board").getByRole("listitem")).toHaveCount(3);
  await expect(page.getByRole("region", { name: "Try it like this" })).toHaveCount(0);

  await saved.getByRole("button", { name: "Remove" }).click();
  await expect(saved).toHaveCount(0);

  await page.goto(`/closet/${suggested.item_id}`);
  await expect(fix.getByRole("button", { name: "Save outfit" })).toBeVisible();
});

test("a complaint no outfit can fix gets one plain line", async ({ page }) => {
  await page.goto(`/closet/${nothingHelps.item_id}`);
  const fix = page.getByRole("region", { name: "Try it like this" });
  await expect(fix.getByText("Nothing in your closet fixes this yet.")).toBeVisible();
  await expect(fix.getByTestId("outfit-board")).toHaveCount(0);
  await expect(fix.getByRole("button")).toHaveCount(0);
});

test("a piece rated low with no complaint gets an outfit too, and shows its stars", async ({ page }) => {
  await page.goto(`/closet/${lowRated.item_id}`);
  const stars = page.getByRole("group", { name: "Your rating" });
  await expect(stars).toHaveAttribute("data-rating", String(ratingOf(lowRated.item_id)));
  const fix = page.getByRole("region", { name: "Try it like this" });
  await expect(fix.getByTestId("fix-reason")).toHaveText(lowRated.reason!);
  await expect(fix.getByTestId("outfit-board").getByRole("listitem")).toHaveCount(lowRated.outfit_item_ids!.length);
});

test("one tap rates an item, and tapping the same star again clears it", async ({ page }) => {
  // Its own item, so seed rows are never written to. With a photo, like every
  // item saved from the add page: buy.spec needs every piece to have one.
  const photo = `${DEMO_USER_ID}/${randomUUID()}.webp`;
  const upload = await db.storage.from("item-images").upload(photo, await sharp(await fakeScreenshot()).webp().toBuffer(), {
    contentType: "image/webp",
  });
  if (upload.error) throw upload.error;
  const { data, error } = await db
    .from("items")
    .insert({
      user_id: DEMO_USER_ID,
      entry_method: "manual",
      title: `E2E rated tee ${randomUUID().slice(0, 8)}`,
      category: "top",
      image_paths: [photo],
      ai_tags: { category: "top", colors: [{ name: "navy" }], materials: ["cotton"], formality: 2, occasions: ["social"] },
    })
    .select("id")
    .single();
  if (error) throw error;
  try {
    await page.goto(`/closet/${data.id}`);
    const stars = page.getByRole("group", { name: "Your rating" });
    await expect(stars).toHaveAttribute("data-rating", "0");

    await stars.getByRole("button", { name: "4 stars" }).click();
    await expect(stars).toHaveAttribute("data-rating", "4");
    await expect(stars.getByRole("button", { pressed: true })).toHaveCount(4);
    await page.reload();
    await expect(stars).toHaveAttribute("data-rating", "4");

    await stars.getByRole("button", { name: "2 stars" }).click();
    await expect(stars).toHaveAttribute("data-rating", "2");
    await expect(stars.getByRole("button", { name: "2 stars" })).toBeEnabled();
    await stars.getByRole("button", { name: "2 stars" }).click();
    await expect(stars).toHaveAttribute("data-rating", "0");
    await page.reload();
    await expect(stars).toHaveAttribute("data-rating", "0");
    await expect(stars.getByRole("button", { pressed: true })).toHaveCount(0);
  } finally {
    await db.from("items").delete().eq("id", data.id);
    await db.storage.from("item-images").remove([photo]);
  }
});
