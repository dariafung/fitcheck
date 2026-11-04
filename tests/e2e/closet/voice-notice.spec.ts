import { createClient } from "@supabase/supabase-js";
import { AiBudgetError, AiOutputError, type AiError } from "../../../lib/ai/errors";
import { aiErrorResponse } from "../../../lib/ai/http";
import { AI_BUDGET_NOTICE } from "../../../lib/ai/notices";
import { DEMO_USER_ID } from "../../../lib/db/current-user";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";

// A fake mic, so hold-to-talk records real (silent) audio in headless Chrome.
// These args replace the project's, so --mute-audio is repeated here.
test.use({
  launchOptions: {
    args: ["--mute-audio", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
  permissions: ["microphone"],
});

const env = readLocalSupabase();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

// Any seeded item of the demo persona. Every write below is answered by the
// test, so nothing is stored or sent to the model.
async function seededItemId(): Promise<string> {
  const { data } = await db
    .from("items")
    .select("id")
    .eq("user_id", DEMO_USER_ID)
    .eq("status", "active")
    .limit(1)
    .throwOnError();
  if (!data?.length) throw new Error("Demo persona has no items: run `pnpm seed` first.");
  return data[0].id;
}

async function recordAndFail(page: import("@playwright/test").Page, err: AiError) {
  const failed = aiErrorResponse(err);
  const body = await failed.text();
  await page.route("**/feelings/voice/upload", (route) =>
    route.fulfill({ json: { path: "e2e.wav", uploadUrl: "http://localhost/e2e-upload" } }),
  );
  await page.route("http://localhost/e2e-upload", (route) => route.fulfill({ status: 200 }));
  await page.route("**/feelings/voice", (route) =>
    route.fulfill({ status: failed.status, contentType: "application/json", body }),
  );

  await page.goto(`/closet/${await seededItemId()}`);
  const feeling = page.getByRole("region", { name: "How it feels" });
  const edit = feeling.getByRole("button", { name: "Edit note", exact: true });
  if (await edit.isVisible()) await edit.click();
  const talk = feeling.getByRole("button", { name: "Hold to talk" });
  await talk.hover();
  await page.mouse.down();
  // Past MIN_VOICE_MS once the clock reads a full second.
  await expect(feeling.getByRole("status")).toContainText("0:01");
  await page.mouse.up();
  return feeling;
}

test("the button stays readable while it records under the pointer", async ({ page }) => {
  await page.goto(`/closet/${await seededItemId()}`);
  const feeling = page.getByRole("region", { name: "How it feels" });
  const edit = feeling.getByRole("button", { name: "Edit note", exact: true });
  if (await edit.isVisible()) await edit.click();
  await feeling.getByRole("button", { name: "Hold to talk" }).hover();
  await page.mouse.down();
  const talk = feeling.getByRole("button", { name: "Release when done" });
  await expect(talk).toBeVisible();
  await expect(talk).toHaveCSS("background-color", "rgb(17, 17, 17)");
  await expect(talk).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.mouse.up();
});

test("when the day's AI budget is spent, voice says so", async ({ page }) => {
  const feeling = await recordAndFail(page, new AiBudgetError("transcribe"));
  await expect(feeling.getByRole("alert")).toHaveText(AI_BUDGET_NOTICE);
  await expect(feeling.getByRole("button", { name: "Hold to talk" })).toBeEnabled();
});

test("when the AI fails, voice asks to try again", async ({ page }) => {
  const feeling = await recordAndFail(page, new AiOutputError("transcribe", []));
  await expect(feeling.getByRole("alert")).toHaveText("Couldn't turn that into text. Try again.");
  await expect(feeling.getByRole("button", { name: "Hold to talk" })).toBeEnabled();
});
