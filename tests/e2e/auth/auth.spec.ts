import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { DEMO_READ_ONLY } from "../../../lib/auth/messages";
import { fakeScreenshot } from "../../../lib/entry/fake-screenshot";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";
import type { Page } from "@playwright/test";

// Runs with sign-in on (playwright.auth.config.ts). Every account made here
// is deleted afterwards; the demo persona is only read.
const env = readLocalSupabase();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const PASSWORD = "e2e-password";
const SEED_ITEM = { id: "2262ce87-2107-4b70-8e85-33f8ecb2b8bb", title: "Faux Suede Belted Jacket" };
const created: string[] = [];

test.afterAll(async () => {
  for (const id of created) {
    const { data: files } = await db.storage.from("item-images").list(id);
    if (files?.length) await db.storage.from("item-images").remove(files.map((f) => `${id}/${f.name}`));
    await db.from("users").delete().eq("id", id);
    await db.auth.admin.deleteUser(id);
  }
});

async function signUp(page: Page): Promise<string> {
  const email = `e2e-${randomUUID().slice(0, 8)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/closet");
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`No auth user for ${email}`);
  created.push(user.id);
  return email;
}

async function tryDemo(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo account" }).click();
  await expect(page).toHaveURL("/");
}

test("signed out, pages send you to log in", async ({ page }) => {
  await page.goto("/closet");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome to fitcheck" })).toBeVisible();
  // The demo account comes first; logging in sits under it.
  const buttons = page.getByRole("main").getByRole("button");
  await expect(buttons.first()).toHaveText("Try the demo account");
  await expect(buttons.last()).toHaveText("Log in");
  // No top-bar link is the login page, so none is marked current.
  await expect(page.getByRole("navigation").locator("[aria-current]")).toHaveCount(0);
});

test("sign up and land on an empty closet", async ({ page }) => {
  await signUp(page);
  await expect(page.getByText("Your closet is empty.")).toBeVisible();
  await expect(page.getByText(SEED_ITEM.title)).toBeHidden();
});

test("a new account can add its first item", async ({ page }) => {
  await signUp(page);
  await page.getByRole("link", { name: /add/i }).first().click();
  await expect(page).toHaveURL("/closet/add");
  await page.getByLabel("Choose a screenshot").setInputFiles({
    name: "tee.png",
    mimeType: "image/png",
    buffer: await fakeScreenshot(),
  });
  const card = page.getByRole("form", { name: "Item details" });
  await card.getByLabel("Name").fill("First tee");
  await card.getByRole("button", { name: "Save to closet" }).click();
  await expect(page.getByRole("status")).toContainText("First tee is in your closet.");

  await page.goto("/closet");
  await expect(page.getByRole("link", { name: "First tee" })).toBeVisible();
  await page.goto("/closet?tab=passing-on");
  await expect(page.getByText("Nothing to pass on.")).toBeVisible();
});

test("log in with the account you made, then log out", async ({ page }) => {
  const email = await signUp(page);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/login");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/");
});

test("on a phone, Log out moves from the top bar to Profile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(page);
  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("link", { name: "Profile", exact: true })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Log out" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await nav.getByRole("link", { name: "Profile", exact: true }).click();
  await page.getByRole("main").getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/login");
});

test("Try the demo account opens the persona's closet", async ({ page }) => {
  await tryDemo(page);
  // Signing up starts from the login page or the read-only notes, not the top bar.
  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("button", { name: "Log out" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Sign up" })).toHaveCount(0);
  await page.goto("/closet");
  await expect(page.getByRole("link", { name: SEED_ITEM.title })).toBeVisible();
});

test("the demo account can look but not change anything", async ({ page }) => {
  await tryDemo(page);
  const before = await db.from("items").select("*").eq("id", SEED_ITEM.id).single();

  await page.goto(`/closet/${SEED_ITEM.id}`);
  await expect(page.getByRole("heading", { level: 1, name: SEED_ITEM.title })).toBeVisible();
  await expect(page.getByText(DEMO_READ_ONLY).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /edit|pass it on/i })).toHaveCount(0);

  await page.goto("/closet/add");
  await expect(page.getByText(DEMO_READ_ONLY)).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose a screenshot" })).toBeHidden();

  await page.goto("/profile");
  await expect(page.getByText(DEMO_READ_ONLY).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
  // Sizes show; the demo account is never anyone's buyer, so no Resale.
  await expect(page.getByLabel("Tops & dresses")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resale" })).toHaveCount(0);

  // The server says no even when the page is skipped. The body is invalid on
  // purpose: if the block ever goes missing this fails with 400 and writes nothing.
  const res = await page.request.patch(`/api/items/${SEED_ITEM.id}`, { data: {} });
  expect(res.status()).toBe(403);
  expect(await res.json()).toMatchObject({ message: DEMO_READ_ONLY });
  const del = await page.request.delete(`/api/items/${SEED_ITEM.id}`);
  expect(del.status()).toBe(403);

  const after = await db.from("items").select("*").eq("id", SEED_ITEM.id).single();
  expect(after.data).toEqual(before.data);
});
