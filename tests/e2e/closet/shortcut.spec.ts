import { createClient } from "@supabase/supabase-js";
import { DEMO_USER_ID } from "../../../lib/db/current-user";
import { fakeScreenshot } from "../../../lib/entry/fake-screenshot";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";

// Sign-in is off in this run, so the visitor is the persona and may write.
// The token made here is the persona's; it is removed afterwards.
const env = readLocalSupabase();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const removeTokens = () => db.from("api_tokens").delete().eq("user_id", DEMO_USER_ID);

test.beforeAll(removeTokens);
test.afterAll(removeTokens);

test("a token made in Profile runs a check from a screenshot, until it is revoked", async ({ page }) => {
  await page.goto("/profile");
  const block = page.getByRole("region", { name: "Shortcut" });
  await expect(block.getByText("No token yet.")).toBeVisible();
  await expect(block.getByRole("link", { name: "How to set up the Shortcut" })).toHaveAttribute("href", /docs\/SHORTCUT\.md$/);

  await block.getByRole("button", { name: "Create token" }).click();
  const box = block.getByLabel(/^Your token/);
  await expect(box).toHaveValue(/^fc_[A-Za-z0-9_-]{43}$/);
  const token = await box.inputValue();

  // What the Shortcut does: the screenshot as the body, the token as Bearer.
  const shot = await fakeScreenshot();
  const send = (bearer: string) =>
    page.request.post("/api/shortcut/check", {
      headers: { authorization: `Bearer ${bearer}`, "content-type": "image/png" },
      data: shot,
    });
  const res = await send(token);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.title).toBe("Mock item");
  expect(body.text.split("\n")[0]).toBe("Mock item (top)");
  expect(body.text).toContain(`${body.score}/100 · ${body.verdict}`);

  // After a reload the token is gone from the page for good.
  await page.reload();
  await expect(block.getByText(/^Token made .+\. Last used .+\.$/)).toBeVisible();
  await expect(block.getByLabel(/^Your token/)).toHaveCount(0);
  await expect(page.getByText(token)).toHaveCount(0);

  await block.getByRole("button", { name: "Revoke" }).click();
  await expect(block.getByText("No token yet.")).toBeVisible();
  expect((await send(token)).status()).toBe(401);
});

test("without a token the endpoint answers 401", async ({ request }) => {
  const res = await request.post("/api/shortcut/check", {
    headers: { "content-type": "image/png" },
    data: await fakeScreenshot(),
  });
  expect(res.status()).toBe(401);
  expect((await res.json()).error).toBe("bad_token");
});
