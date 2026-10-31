import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { DAILY_LIMIT_NOTICE } from "../../../lib/ai/notices";
import { fakeScreenshot } from "../../../lib/entry/fake-screenshot";
import { DAILY_LIMITS } from "../../../lib/limits/limits";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";

// Runs with sign-in on (playwright.auth.config.ts). The account made here,
// and its daily counts, are deleted afterwards.
const env = readLocalSupabase();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
let userId = "";

test.afterAll(async () => {
  if (!userId) return;
  await db.from("ai_usage_days").delete().eq("subject", `user:${userId}`);
  await db.from("users").delete().eq("id", userId);
  await db.auth.admin.deleteUser(userId);
});

// Today in Chicago, when daily counts reset.
const chicagoDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());

test("an account that used up today's screenshot reads is told to come back tomorrow", async ({ page }) => {
  const email = `e2e-${randomUUID().slice(0, 8)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/closet");
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  userId = data.users.find((u) => u.email === email)!.id;

  // As if the day's reads were spent already.
  const { error } = await db
    .from("ai_usage_days")
    .insert({ subject: `user:${userId}`, day: chicagoDay(), action: "read", count: DAILY_LIMITS.read });
  expect(error).toBeNull();

  await page.goto("/closet/add");
  await page.getByLabel("Choose a screenshot").setInputFiles({
    name: "tee.png",
    mimeType: "image/png",
    buffer: await fakeScreenshot(),
  });
  await expect(page.getByRole("status")).toContainText(DAILY_LIMIT_NOTICE);
  await expect(page.getByRole("form", { name: "Item details" })).toBeHidden();
});
