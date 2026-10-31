import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { AiUpstreamError } from "../../../lib/ai/errors";
import { AI_BUDGET_NOTICE } from "../../../lib/ai/notices";
import { aiErrorResponse } from "../../../lib/ai/http";
import { MOCK_INCOMPLETE_TITLE } from "../../../lib/ai/mock/score-purchase";
import { fakeScreenshot } from "../../../lib/entry/fake-screenshot";
import { CANDIDATE_ITEM_ID } from "../../../lib/check/pairings";
import { ACCESSORY_NOTICE, INCOMPLETE_NOTICE, STYLE_FAILED, STYLE_IT, STYLING } from "../../../lib/check/reasons";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";
import { expect, test } from "../fixtures";

const env = readLocalSupabase();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const persona = JSON.parse(readFileSync("seed/persona.json", "utf8"));

// By title: other specs may add items to the persona at the same time.
async function itemsTitled(title: string) {
  const { data } = await db
    .from("items")
    .select("id")
    .eq("user_id", persona.id)
    .eq("title", title)
    .throwOnError();
  return data;
}

test.beforeAll(async () => {
  // Checks run against the demo persona's closet; make sure it exists without touching it.
  await db.from("users").upsert(persona, { ignoreDuplicates: true }).throwOnError();
});

async function upload(page: import("@playwright/test").Page) {
  await page.getByLabel("Choose a screenshot").setInputFiles({
    name: "loafers.png",
    mimeType: "image/png",
    buffer: await fakeScreenshot(),
  });
  const card = page.getByRole("form", { name: "Item details" });
  await expect(card.getByLabel("Name")).toHaveValue("Mock item");
  return card;
}

test("check an item: screenshot, confirm, score, check another", async ({ page }) => {
  await page.goto("/check");
  const card = await upload(page);
  await expect(card.getByRole("img", { name: "Mock item" })).toBeVisible();
  await expect(card.getByText("Fix anything that's off, then check.")).toBeVisible();
  await card.getByLabel("Name").fill("Black loafers");
  await card.getByLabel("Type").selectOption("shoes");

  await card.getByRole("button", { name: "Check it" }).click();
  const result = page.getByRole("region", { name: "Result" });
  await expect(result.getByRole("heading", { name: "Black loafers" })).toBeVisible();
  await expect(result.getByTestId("score")).toHaveText(/^\d{1,3}(\.\d)?$/);
  for (const part of ["Suits you", "Outfits", "Revives", "Fills a gap", "Not a repeat"]) {
    await expect(result.getByText(part, { exact: true })).toBeVisible();
  }
  // Each fit question shows its own score out of 8.
  await result.getByText("Why", { exact: true }).click();
  const why = result.locator("details li");
  await expect(why).toHaveCount(5);
  for (const row of await why.all()) await expect(row).toHaveText(/^\d\/8/);

  // Nothing about the item was kept.
  expect(await itemsTitled("Black loafers")).toEqual([]);
  const { data: pairs } = await db
    .from("pairings")
    .select("id")
    .or(`item_a_id.eq.${CANDIDATE_ITEM_ID},item_b_id.eq.${CANDIDATE_ITEM_ID}`)
    .throwOnError();
  expect(pairs).toEqual([]);

  await result.getByRole("button", { name: "Check another" }).click();
  await expect(result).toBeHidden();
  await expect(page.getByLabel("Choose a screenshot")).toBeEnabled();
});

test("sample outfits show as boards of real photos; an on-model photo is cut out first", async ({ page }) => {
  const cutouts: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/checks/cutout") cutouts.push(r.method());
  });
  // Mark the mock draft as on-model; everything else is the real flow.
  await page.route("**/api/checks/extract", async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    await route.fulfill({ response: res, json: { draft: { ...json.draft, onModel: true } } });
  });
  await page.goto("/check");
  const card = await upload(page);
  await expect(page.getByText("Photo cleaned up by AI.")).toBeVisible();
  expect(cutouts).toEqual(["POST"]);
  await card.getByLabel("Name").fill("Black loafers");
  await card.getByLabel("Type").selectOption("shoes");
  await card.getByRole("button", { name: "Check it" }).click();

  const result = page.getByRole("region", { name: "Result" });
  const board = result.getByTestId("outfit-board").first();
  await expect(board).toBeVisible();
  await expect(board.getByText("New", { exact: true })).toBeVisible();
  await expect(board.getByRole("img", { name: "Black loafers" })).toBeVisible();
  await expect(result.getByRole("list", { name: "Outfit" })).toHaveCount(await result.getByTestId("outfit-board").count());
});

test("when the boards can't load, the plain rows of photos stay", async ({ page }) => {
  await page.route("**/api/checks/board", (route) => route.fulfill({ status: 500, body: "" }));
  await page.goto("/check");
  const card = await upload(page);
  await card.getByLabel("Name").fill("Black loafers");
  await card.getByLabel("Type").selectOption("shoes");
  await card.getByRole("button", { name: "Check it" }).click();
  const result = page.getByRole("region", { name: "Result" });
  await expect(result.getByRole("list", { name: "Outfit" }).first()).toBeVisible();
  await expect(result.getByTestId("outfit-board")).toHaveCount(0);
});

// Checks the mock loafers and waits for the outfit boards.
async function boards(page: import("@playwright/test").Page) {
  await page.goto("/check");
  const card = await upload(page);
  await card.getByLabel("Name").fill("Black loafers");
  await card.getByLabel("Type").selectOption("shoes");
  await card.getByRole("button", { name: "Check it" }).click();
  const result = page.getByRole("region", { name: "Result" });
  await expect(result.getByTestId("outfit-board").first()).toBeVisible();
  return result;
}

test("style it with AI: loading, the AI-generated board, and back to the real photos", async ({ page }) => {
  let styled = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/checks/style") styled++;
  });
  // Hold the answer until the loading state has been seen.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/checks/style", async (route) => {
    await held;
    await route.continue();
  });
  const result = await boards(page);
  const buttons = result.getByRole("button", { name: STYLE_IT });
  await buttons.first().click();

  await expect(result.getByText(STYLING)).toBeVisible();
  // One outfit at a time.
  for (const other of await buttons.all()) await expect(other).toBeDisabled();
  release();

  const ai = result.getByTestId("ai-board");
  await expect(ai).toBeVisible();
  await expect(ai.getByText("AI-generated", { exact: true })).toBeVisible();
  await expect(ai.getByRole("img", { name: /^AI-generated look: .*Black loafers/ })).toBeVisible();
  await expect(result.getByText(STYLING)).toBeHidden();

  await result.getByRole("button", { name: "Show real photos" }).click();
  await expect(ai).toBeHidden();
  await expect(result.getByTestId("outfit-board").first().getByRole("img", { name: "Black loafers" })).toBeVisible();
  await result.getByRole("button", { name: "Show AI look" }).click();
  await expect(result.getByTestId("ai-board")).toBeVisible();
  // The picture is kept on the page, not drawn again.
  expect(styled).toBe(1);
});

test("style it with AI: a failure keeps the board, the budget running out hides the button", async ({ page }) => {
  let answer = { error: "failed" };
  await page.route("**/api/checks/style", (route) => route.fulfill({ json: answer }));
  const result = await boards(page);
  const button = result.getByRole("button", { name: STYLE_IT }).first();
  await button.click();
  await expect(result.getByText(STYLE_FAILED)).toBeVisible();
  await expect(result.getByTestId("ai-board")).toHaveCount(0);
  await expect(result.getByTestId("outfit-board").first()).toBeVisible();

  answer = { error: "budget" };
  await button.click();
  await expect(result.getByText(AI_BUDGET_NOTICE)).toBeVisible();
  await expect(result.getByRole("button", { name: STYLE_IT })).toHaveCount(0);
  await expect(result.getByText(STYLE_FAILED)).toBeHidden();
});

test("when the AI doesn't finish, try again sends the same item and photo", async ({ page }) => {
  const sent: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === "/api/checks") sent.push(r.postData() ?? "");
  });
  await page.goto("/check");
  const card = await upload(page);
  await card.getByLabel("Name").fill(MOCK_INCOMPLETE_TITLE);
  await card.getByLabel("Type").selectOption("shoes");
  await card.getByRole("button", { name: "Check it" }).click();

  await expect(page.getByRole("status")).toContainText(INCOMPLETE_NOTICE);
  await expect(page.getByRole("region", { name: "Result" })).toBeHidden();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(JSON.parse(sent[0]).photo).toMatch(/^data:image\//);
  expect(sent[1]).toBe(sent[0]);
  await expect(page.getByRole("status")).toContainText(INCOMPLETE_NOTICE);
  await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
});

test("accessories aren't scored", async ({ page }) => {
  await page.goto("/check");
  const card = await upload(page);
  await card.getByLabel("Type").selectOption("accessory");
  await card.getByRole("button", { name: "Check it" }).click();
  await expect(page.getByRole("status")).toContainText(ACCESSORY_NOTICE);
  await expect(page.getByRole("region", { name: "Result" })).toBeHidden();

  await page.getByRole("button", { name: "Use another screenshot" }).click();
  await expect(card).toBeHidden();
  await expect(page.getByLabel("Choose a screenshot")).toBeEnabled();
});

test("when the AI fails, the card stays and Check it works again", async ({ page }) => {
  // Answer exactly as the route does, without calling the model.
  const failed = aiErrorResponse(new AiUpstreamError("scorePurchase", 500));
  const body = await failed.text();
  await page.route("**/api/checks", (route) =>
    route.fulfill({ status: failed.status, contentType: "application/json", body }),
  );
  await page.goto("/check");
  const card = await upload(page);
  await card.getByRole("button", { name: "Check it" }).click();
  await expect(page.getByRole("status")).toContainText("Couldn't check it. Try again?");
  await expect(page.getByRole("region", { name: "Result" })).toBeHidden();
  await expect(card.getByRole("button", { name: "Check it" })).toBeEnabled();
});
