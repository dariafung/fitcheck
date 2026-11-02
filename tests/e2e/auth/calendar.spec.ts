import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { DEMO_READ_ONLY } from "../../../lib/auth/messages";
import { DEMO_USER_ID } from "../../../lib/db/demo-user";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";

// Sign-in on. Accounts made here are deleted afterwards; the persona's
// calendar (from `pnpm seed`) is only read.
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

async function signUp(page: Page) {
  const email = `e2e-cal-${randomUUID().slice(0, 8)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/closet");
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`No auth user for ${email}`);
  created.push(user.id);
}

test("the demo account can look through the calendar but not log anything", async ({ page }) => {
  const { count: before } = await db.from("outfit_logs").select("id", { count: "exact", head: true }).eq("user_id", DEMO_USER_ID);

  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo account" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("navigation").getByRole("link", { name: "Calendar", exact: true }).click();

  // Opens on its latest logged day, showing what was worn.
  const panel = page.getByRole("region", { name: /^\w{3}, \w{3} \d+$/ });
  await expect(panel.getByRole("listitem", { name: "Outfit 1" })).toBeVisible();
  await expect(panel.getByText(DEMO_READ_ONLY)).toBeVisible();
  await expect(page.getByRole("button", { name: /^(save|edit|delete|log an outfit|add another outfit)/i })).toHaveCount(0);
  await expect(page.getByRole("region", { name: /30 days/ }).getByText("Most worn")).toBeVisible();

  // The server says no too.
  const res = await page.request.post("/api/wear/outfits", { data: {} });
  expect(res.status()).toBe(403);
  const { count: after } = await db.from("outfit_logs").select("id", { count: "exact", head: true }).eq("user_id", DEMO_USER_ID);
  expect(after).toBe(before);
});

test("a new account can turn the calendar off and on in Profile", async ({ page }) => {
  await signUp(page);
  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("link", { name: "Calendar", exact: true })).toBeVisible();

  await page.goto("/profile#calendar");
  const setting = page.getByRole("region", { name: "Outfit calendar" });
  const toggle = setting.getByRole("checkbox", { name: "Keep an outfit calendar" });
  await expect(toggle).toBeChecked();
  await expect(setting.getByText("Turning it off hides it. Your log is kept.")).toBeVisible();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(nav.getByRole("link", { name: "Calendar", exact: true })).toHaveCount(0);

  await page.goto("/calendar");
  await expect(page.getByText("Your outfit calendar is off.")).toBeVisible();
  await page.getByRole("link", { name: "Turn it on in Profile" }).click();
  await page.getByRole("checkbox", { name: "Keep an outfit calendar" }).click();
  await expect(page.getByRole("checkbox", { name: "Keep an outfit calendar" })).toBeChecked();
  await expect(nav.getByRole("link", { name: "Calendar", exact: true })).toBeVisible();

  // An empty closet has nothing to log yet.
  await nav.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page.getByText("Your closet is empty.")).toBeVisible();
});
