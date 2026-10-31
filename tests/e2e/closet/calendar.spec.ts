import { createClient } from "@supabase/supabase-js";
import { DEMO_USER_ID } from "../../../lib/db/current-user";
import { localDay, longDay } from "../../../lib/wear/day";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";

// Sign-in off: the current user is the persona, whose 30 days of outfits come
// from the seed (`pnpm seed`) and end yesterday. Tests only log today, and
// remove today's outfits afterwards.
const env = readLocalSupabase();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const SHIRT = "Supima Long Sleeve T-Shirt";
const SNEAKERS = "Japan Pro";
const JEANS = "ZW Collection High-Rise Straight Fit Jeans";
// The browser and this process share a clock and a time zone.
const TODAY = localDay();

// One test at a time: they all write the persona's today.
test.describe.configure({ mode: "serial" });

async function clearToday() {
  const { error } = await db.from("outfit_logs").delete().eq("user_id", DEMO_USER_ID).eq("worn_on", TODAY);
  if (error) throw error;
}

test.beforeEach(async () => {
  const { count } = await db.from("outfit_logs").select("id", { count: "exact", head: true }).eq("user_id", DEMO_USER_ID);
  if (!count) throw new Error("The persona has no outfits: run `pnpm seed` first.");
  await clearToday();
});
test.afterEach(clearToday);

test("logs today's outfits from the top bar, then edits and deletes one", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Calendar", level: 1 })).toBeVisible();

  // Today is picked and, with nothing logged yet, ready to log.
  const panel = page.getByRole("region", { name: longDay(TODAY) });
  await expect(page.getByRole("button", { name: longDay(TODAY), exact: true })).toHaveAttribute("aria-pressed", "true");
  await panel.getByRole("button", { name: SHIRT }).click();
  await panel.getByRole("button", { name: JEANS }).click();
  await panel.getByRole("button", { name: "School" }).click();
  await panel.getByRole("button", { name: "Save" }).click();

  const first = panel.getByRole("listitem", { name: "Outfit 1" });
  await expect(first).toContainText("School");
  await expect(page.getByRole("button", { name: `${longDay(TODAY)}, 1 outfit` })).toBeVisible();

  // A second outfit the same day, for sport.
  await panel.getByRole("button", { name: "Add another outfit" }).click();
  await panel.getByRole("button", { name: SNEAKERS }).click();
  await panel.getByRole("button", { name: "Sport" }).click();
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(panel.getByRole("listitem", { name: "Outfit 2" })).toContainText("Sport");
  await expect(page.getByRole("button", { name: `${longDay(TODAY)}, 2 outfits` })).toBeVisible();

  // Edit the first: drop the jeans, clear the occasion.
  await panel.getByRole("button", { name: "Edit outfit 1" }).click();
  await panel.getByRole("button", { name: JEANS }).click();
  await panel.getByRole("button", { name: "School" }).click();
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(first).not.toContainText("School");
  await expect(first.getByRole("img")).toHaveCount(1);

  // Delete the second, confirming in place.
  await panel.getByRole("button", { name: "Delete outfit 2" }).click();
  await panel.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(panel.getByRole("listitem", { name: "Outfit 2" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: `${longDay(TODAY)}, 1 outfit` })).toBeVisible();
});

test("won't log the same pieces twice on one day", async ({ page }) => {
  await page.goto("/calendar");
  const panel = page.getByRole("region", { name: longDay(TODAY) });
  await panel.getByRole("button", { name: SNEAKERS }).click();
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(panel.getByRole("listitem", { name: "Outfit 1" })).toBeVisible();

  await panel.getByRole("button", { name: "Add another outfit" }).click();
  await panel.getByRole("button", { name: SNEAKERS }).click();
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(panel.getByRole("alert")).toHaveText("You already logged this outfit for that day.");
  await expect(panel.getByRole("listitem", { name: /^Outfit/ })).toHaveCount(1);
});

test("shows the seeded month, the 30-day numbers and what the AI noticed", async ({ page }) => {
  await page.goto("/calendar");
  // Pick a seeded day; its outfit shows with Edit and Delete.
  const logged = page.getByRole("button", { name: /, \d outfits?$/ }).first();
  const name = (await logged.getAttribute("aria-label"))!;
  await logged.click();
  const panel = page.getByRole("region", { name: name.split(",").slice(0, 2).join(",") });
  await expect(panel.getByRole("listitem", { name: "Outfit 1" })).toBeVisible();

  const stats = page.getByRole("region", { name: /30 days/ });
  await expect(stats.getByText("Most worn")).toBeVisible();
  await expect(stats.getByText("You complain, you wear it")).toBeVisible();
  await expect(stats.getByRole("link", { name: new RegExp(JEANS) }).first()).toBeVisible();

  // Mock insights, written once the page is up (or already cached).
  const insights = page.getByRole("region", { name: "What we noticed" });
  await expect(insights.getByText(/^Mock: /).first()).toBeVisible();
  await expect(insights.getByText("Written by AI from your log and notes.")).toBeVisible();

  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(page).toHaveURL(/\?month=\d{4}-\d{2}$/);
});

test("an item page says how often it was worn", async ({ page }) => {
  const { data } = await db.from("items").select("id").eq("user_id", DEMO_USER_ID).eq("title", JEANS).single();
  await page.goto(`/closet/${data!.id}`);
  await expect(page.getByRole("term").filter({ hasText: "Worn" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: /times in the (last )?30 days/ })).toBeVisible();
});
