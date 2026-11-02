import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";

// Sign-in on. Accounts made here are deleted afterwards; the persona is only read.
const env = readLocalSupabase();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const created: string[] = [];

test.afterAll(async () => {
  for (const id of created) {
    await db.from("users").delete().eq("id", id);
    await db.auth.admin.deleteUser(id);
  }
});

async function signUp(page: Page): Promise<string> {
  const email = `e2e-style-${randomUUID().slice(0, 8)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/closet");
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`No auth user for ${email}`);
  created.push(user.id);
  return user.id;
}

// Counts the page's calls that rebuild the style card.
function watchRebuilds(page: Page): string[] {
  const calls: string[] = [];
  page.on("request", (req) => {
    if (req.url().endsWith("/api/style-profile")) calls.push(req.method());
  });
  return calls;
}

// Three items whose feelings are already parsed, as if written earlier.
async function feltCloset(userId: string) {
  const { data: items, error } = await db
    .from("items")
    .insert(
      ["white", "navy", "gray"].map((color, i) => ({
        user_id: userId,
        entry_method: "manual",
        title: `E2E ${color} piece`,
        category: i === 1 ? "bottom" : "top",
        ai_tags: {
          category: i === 1 ? "bottom" : "top",
          colors: [{ name: color }],
          materials: ["cotton"],
          formality: 2,
          occasions: ["school"],
        },
      })),
    )
    .select("id");
  if (error) throw error;
  const felt = await db.from("item_feelings").insert(
    items.map((item) => ({
      item_id: item.id,
      user_id: userId,
      raw_text: "Comfy and bright.",
      source: "typed",
      structured: {
        flattering: "yes",
        liked: "yes",
        aspects: [{ aspect: "feel", sentiment: "positive", said: "comfy", means: "soft cotton suits you" }],
        occasions: [],
        mood: [],
        summary: "Comfy and bright.",
      },
      parsed_at: new Date().toISOString(),
    })),
  );
  if (felt.error) throw felt.error;
}

test("the demo account sees the seeded style card and never rebuilds it", async ({ page }) => {
  const rebuilds = watchRebuilds(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo account" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("region", { name: "Your style" }).getByRole("term").first()).toHaveText("Colors");
  expect(rebuilds).toEqual([]);
});

test("a new account is told what the style card needs", async ({ page }) => {
  await signUp(page);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Your style" })).toContainText("Add a note to 3 pieces");
});

test("the style card builds itself once there are three feelings", async ({ page }) => {
  const userId = await signUp(page);
  await feltCloset(userId);
  const rebuilds = watchRebuilds(page);

  await page.goto("/");
  const card = page.getByRole("region", { name: "Your style" });
  await expect(card.getByText(/^Updated /)).toBeVisible();
  await expect(card.getByRole("term").filter({ hasText: "Fabrics" })).toBeVisible();
  expect(rebuilds).toEqual(["POST"]);

  // Built for this closet: opening home again just shows it.
  await page.reload();
  await expect(card.getByText(/^Updated /)).toBeVisible();
  expect(rebuilds).toEqual(["POST"]);
});
