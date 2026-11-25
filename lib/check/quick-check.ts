// The one-tap check (POST /api/shortcut/check, docs/SHORTCUT.md): a
// product-page screenshot goes straight to the buy check, with no card to
// confirm in between, and comes back as a few lines of plain text an iOS
// Shortcut can show. The steps are the page's own (/api/checks/extract, then
// /api/checks) minus the cut-out; nothing is stored. Its copy lives here.
import { AiError } from "../ai/errors";
import type { Category } from "../ai/schemas/common";
import type { ExtractItemInput, ExtractItemOutput } from "../ai/schemas/extract-item";
import type { Db } from "../db/server";
import type { EntryErrorCode } from "../entry/draft";
import { frameOriginal } from "../entry/frame";
import { productPhoto, readScreenshot } from "../entry/screenshot";
import { cleanTitle } from "../entry/title";
import type { GiveBackWhen } from "../limits/daily";
import { isIncomplete, runBuyCheck, type BuyCheckResult, type RepeatFn, type ScoreFn } from "./buy-check";
import type { JudgeFn } from "./judge";
import { verdictFor, type Verdict } from "./verdict";

// Same cap as the check page's own request.
const MAX_TITLE_LENGTH = 200;

export interface QuickCheckAi {
  extract: (input: ExtractItemInput) => Promise<ExtractItemOutput>;
  judge: JudgeFn;
  score: ScoreFn;
  repeat: RepeatFn;
}

// Runs one counted AI action for the caller (withDaily, lib/limits/daily.ts).
export type Counted = <T>(action: "read" | "check", run: () => Promise<T>, when?: GiveBackWhen<T>) => Promise<T>;

// What was read off the screenshot, shown back so a misread is visible.
interface Read {
  title: string;
  category: Category;
}

export type QuickCheck =
  // The screenshot can't be used, or shows no product.
  | { kind: "unreadable"; error: EntryErrorCode }
  | ({ kind: "accessory"; message: string } & Read)
  // The scoring models never finished, after every retry.
  | ({ kind: "incomplete" } & Read)
  | ({ kind: "checked"; result: BuyCheckResult } & Read)
  | { kind: "no_user" };

// Screenshot → check. Throws the AI layer's errors (a used-up daily limit,
// the budget, a model that failed) for the route to answer.
export async function runQuickCheck(
  db: Db,
  userId: string,
  file: Blob | null,
  ai: QuickCheckAi,
  counted: Counted,
): Promise<QuickCheck> {
  if (!file || file.size === 0) return { kind: "unreadable", error: "no_file" };
  const shot = await readScreenshot(file);
  if ("error" in shot) return { kind: "unreadable", error: shot.error };

  const extracted = await counted("read", () =>
    ai.extract({
      knownFields: {},
      images: [],
      screenshot: { kind: "inline", mime: shot.mime, base64: shot.data.toString("base64") },
      allowWebSearch: true,
    }),
  );
  if (!extracted.recognized) return { kind: "unreadable", error: "unrecognized" };

  const read: Read = {
    title: cleanTitle(extracted.title, extracted.brand).slice(0, MAX_TITLE_LENGTH),
    category: extracted.tags.category,
  };
  // The product photo framed as the check page frames it, never cut out by
  // the model. An accessory is turned away before its photo is needed.
  let photo: Buffer | null = null;
  if (read.category !== "accessory") {
    const cropped = await productPhoto(shot, extracted.productBox);
    photo = await frameOriginal(cropped.webp, cropped.probe);
  }

  try {
    // Counted like /api/checks: an accessory or a missing user never reaches
    // the model, and a model that failed is on us.
    const check = await counted(
      "check",
      () => runBuyCheck(db, userId, {
          title: read.title,
          tags: extracted.tags,
          photo,
          page: { brand: extracted.brand, size: extracted.size, shopperFit: extracted.shopperFit },
        }, ai),
      { result: (c) => !c || "unsupported" in c, error: (err) => err instanceof AiError || isIncomplete(err) },
    );
    if (!check) return { kind: "no_user" };
    if ("unsupported" in check) return { kind: "accessory", message: check.message, ...read };
    return { kind: "checked", result: check.result, ...read };
  } catch (err) {
    if (isIncomplete(err)) return { kind: "incomplete", ...read };
    throw err;
  }
}

// Copy ------------------------------------------------------------------

const CATEGORY: Record<Category, string> = {
  top: "top",
  bottom: "bottom",
  one_piece: "one-piece",
  shoes: "shoes",
  outerwear: "jacket",
  accessory: "accessory",
};

const PARTS: [keyof BuyCheckResult["parts"], string][] = [
  ["suitsYou", "Suits you"],
  ["outfits", "Outfits"],
  ["revives", "Revives"],
  ["fillsGap", "Fills a gap"],
  ["notRepeat", "Not a repeat"],
];

const UNREADABLE: Record<EntryErrorCode, string> = {
  no_file: "No screenshot came through. Check the Shortcut's steps.",
  not_image: "That isn't a picture we can read. Send a JPEG or PNG.",
  too_large: "That screenshot is too big. Convert it to JPEG before sending.",
  too_small: "That picture is too small to read.",
  unrecognized: "Couldn't spot a product there. Try another screenshot.",
  accessory: "We only check clothes and shoes.",
};

export const EMPTY_CLOSET_TEXT = "Nothing in your closet to compare it with yet. Add a few pieces you wear, then check again.";
export const INCOMPLETE_TEXT = "The AI didn't finish this time. Run it again.";
export const NO_USER_TEXT = "Couldn't find your account. Make a new token in Profile.";
// 401: no token, or one that was never made or has been revoked.
export const BAD_TOKEN_TEXT = "That token doesn't work. Make a new one in Profile and paste it into the Shortcut.";
// 403: the shared demo account.
export const DEMO_TEXT = "The demo account can't use the Shortcut. Sign up to get your own token.";
// A model that failed or can't be reached; limits have their own notices.
export const AI_FAILED_TEXT = "Couldn't check that just now. Try again.";

// "Linen Shirt (top)": the name and type as read.
function readLine({ title, category }: Read): string {
  return `${title} (${CATEGORY[category]})`;
}

// The text the Shortcut shows for a finished check: what was read, score and
// verdict, one line per part, the gap line when the item makes no outfit, and the
// size advice when there is any.
export function summaryText(read: Read, result: BuyCheckResult): string {
  if (result.closetSize === 0) return [readLine(read), EMPTY_CLOSET_TEXT].join("\n");
  return [
    readLine(read),
    `${result.score}/100 · ${verdictFor(result.score)}`,
    ...PARTS.map(([key, label]) => `${label} ${result.parts[key].points}/${result.parts[key].max}`),
    ...(result.gap ? [result.gap.reason] : []),
    ...(result.size ? [`Size: ${result.size.text}`] : []),
  ].join("\n");
}

export interface QuickCheckBody {
  // Null when nothing was scored.
  score: number | null;
  verdict: Verdict | null;
  // The product name as read; null when no product was read.
  title: string | null;
  // Ready to show as it is.
  text: string;
  // Why there is no score, when something went wrong.
  error?: EntryErrorCode | "incomplete" | "no_user";
}

const NOTHING = { score: null, verdict: null };

// The endpoint's JSON for each outcome.
export function quickCheckBody(check: QuickCheck): QuickCheckBody {
  switch (check.kind) {
    case "unreadable":
      return { ...NOTHING, title: null, text: UNREADABLE[check.error], error: check.error };
    case "no_user":
      return { ...NOTHING, title: null, text: NO_USER_TEXT, error: "no_user" };
    case "accessory":
      return { ...NOTHING, title: check.title, text: [readLine(check), check.message].join("\n"), error: "accessory" };
    case "incomplete":
      return { ...NOTHING, title: check.title, text: [readLine(check), INCOMPLETE_TEXT].join("\n"), error: "incomplete" };
    case "checked": {
      const text = summaryText(check, check.result);
      if (check.result.closetSize === 0) return { ...NOTHING, title: check.title, text };
      return { score: check.result.score, verdict: verdictFor(check.result.score), title: check.title, text };
    }
  }
}
