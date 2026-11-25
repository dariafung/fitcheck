import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { AiDailyLimitError } from "../ai/errors";
import type { ExtractItemOutput } from "../ai/schemas/extract-item";
import type { Db } from "../db/server";
import { fakeScreenshot } from "../entry/fake-screenshot";
import { MAX_UPLOAD_BYTES } from "../entry/screenshot";
import type { BuyCheckResult } from "./buy-check";
import {
  EMPTY_CLOSET_TEXT,
  INCOMPLETE_TEXT,
  quickCheckBody,
  runQuickCheck,
  summaryText,
  type Counted,
  type QuickCheckAi,
} from "./quick-check";
import { ACCESSORY_NOTICE } from "./reasons";

const part = (points: number, max: number) => ({ points, max, reason: "" });

function result(over: Partial<BuyCheckResult> = {}): BuyCheckResult {
  return {
    score: 72.5,
    summary: "The cut works for you.",
    parts: {
      suitsYou: { ...part(30, 40), answers: [] },
      outfits: { ...part(12.5, 20), count: 5 },
      revives: { ...part(8, 15), items: [] },
      fillsGap: { ...part(13, 15), tier: "more_outfits", occasions: [] },
      notRepeat: { ...part(9, 10), item: null },
    },
    gap: null,
    sampleOutfits: [],
    size: null,
    closetSize: 12,
    stats: {} as BuyCheckResult["stats"],
    ...over,
  };
}

const LOAFERS = { title: "Penny Loafers", category: "shoes" as const };

describe("summaryText", () => {
  it("says what was read, the score and verdict, and each part on a line", () => {
    expect(summaryText(LOAFERS, result())).toBe(
      [
        "Penny Loafers (shoes)",
        "72.5/100 · A GOOD ADD",
        "Suits you 30/40",
        "Outfits 12.5/20",
        "Revives 8/15",
        "Fills a gap 13/15",
        "Not a repeat 9/10",
      ].join("\n"),
    );
  });

  it("names the category the way the site does", () => {
    expect(summaryText({ title: "Slip Dress", category: "one_piece" }, result())).toMatch(/^Slip Dress \(one-piece\)\n/);
    expect(summaryText({ title: "Trench", category: "outerwear" }, result())).toMatch(/^Trench \(jacket\)\n/);
  });

  it("ends with the gap line when the item makes no outfit", () => {
    const reason = "Creates a gap: none of your tops go with it.";
    const text = summaryText(LOAFERS, result({ score: 31, gap: { kind: "no_match", slots: [], reason } }));
    const lines = text.split("\n");
    expect(lines[1]).toBe("31/100 · SKIP THIS ONE");
    expect(lines.at(-1)).toBe(reason);
    expect(lines).toHaveLength(8);
  });

  it("gives no score for an empty closet, just what to do first", () => {
    const text = summaryText(LOAFERS, result({ closetSize: 0 }));
    expect(text).toBe(`Penny Loafers (shoes)\n${EMPTY_CLOSET_TEXT}`);
    expect(text).not.toMatch(/\d\/100/);
  });

  it("stays a few short lines", () => {
    const lines = summaryText(LOAFERS, result()).split("\n");
    expect(lines.length).toBeLessThanOrEqual(8);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(40);
  });
});

describe("size advice in the text", () => {
  it("adds one line when there is advice and nothing without", () => {
    const size = { kind: "avoid" as const, text: "XS is too small on you in HOLLISTER tops. Skip XS.", notes: ["Based on 1 piece you marked."] };
    expect(summaryText(LOAFERS, result({ size })).split("\n").at(-1)).toBe(`Size: ${size.text}`);
    expect(summaryText(LOAFERS, result())).not.toContain("Size:");
  });
});

describe("quickCheckBody", () => {
  it("is score, verdict, title and text for a check", () => {
    const body = quickCheckBody({ kind: "checked", ...LOAFERS, result: result() });
    expect(body).toEqual({ score: 72.5, verdict: "A GOOD ADD", title: "Penny Loafers", text: summaryText(LOAFERS, result()) });
  });

  it("has no score or verdict for an empty closet", () => {
    const body = quickCheckBody({ kind: "checked", ...LOAFERS, result: result({ closetSize: 0 }) });
    expect(body).toEqual({ score: null, verdict: null, title: "Penny Loafers", text: `Penny Loafers (shoes)\n${EMPTY_CLOSET_TEXT}` });
  });

  it("says why a screenshot couldn't be read", () => {
    for (const error of ["no_file", "not_image", "too_large", "too_small", "unrecognized"] as const) {
      const body = quickCheckBody({ kind: "unreadable", error });
      expect(body).toMatchObject({ score: null, verdict: null, title: null, error });
      expect(body.text.length).toBeGreaterThan(10);
    }
    expect(quickCheckBody({ kind: "unreadable", error: "too_large" }).text).toContain("JPEG");
  });

  it("shows what was read when it turns an accessory away", () => {
    const body = quickCheckBody({ kind: "accessory", title: "Canvas Tote", category: "accessory", message: ACCESSORY_NOTICE });
    expect(body).toEqual({
      score: null,
      verdict: null,
      title: "Canvas Tote",
      text: `Canvas Tote (accessory)\n${ACCESSORY_NOTICE}`,
      error: "accessory",
    });
  });

  it("asks to run it again when the model never finished", () => {
    const body = quickCheckBody({ kind: "incomplete", ...LOAFERS });
    expect(body).toMatchObject({ score: null, title: "Penny Loafers", error: "incomplete" });
    expect(body.text).toBe(`Penny Loafers (shoes)\n${INCOMPLETE_TEXT}`);
  });
});

// The paths that end before the closet is read, so no database is needed.
describe("runQuickCheck", () => {
  const db = {} as Db;
  const extracted = (over: Partial<ExtractItemOutput> = {}): ExtractItemOutput => ({
    title: "LULULEMON CANVAS TOTE *Updated",
    brand: "lululemon",
    tags: {
      category: "accessory",
      colors: [{ name: "black" }],
      materials: [],
      formality: 2,
      occasions: [],
      colorFamily: "black",
      tempRangeF: { min: 30, max: 90 },
    },
    onModel: false,
    sources: [],
    lowConfidence: [],
    recognized: true,
    ...over,
  });

  function setup(output: ExtractItemOutput = extracted()) {
    const actions: string[] = [];
    const givenBack: string[] = [];
    const counted: Counted = async (action, run, when) => {
      actions.push(action);
      const out = await run();
      if (when?.result?.(out)) givenBack.push(action);
      return out;
    };
    const ai: QuickCheckAi = {
      extract: vi.fn(async () => output),
      judge: vi.fn(),
      score: vi.fn(),
      repeat: vi.fn(),
    };
    return { ai, counted, actions, givenBack };
  }

  const shot = async () => new Blob([new Uint8Array(await fakeScreenshot())], { type: "image/png" });

  it("stops at a missing, unreadable or oversized file without asking the model", async () => {
    const { ai, counted, actions } = setup();
    expect(await runQuickCheck(db, "u", null, ai, counted)).toEqual({ kind: "unreadable", error: "no_file" });
    expect(await runQuickCheck(db, "u", new Blob([]), ai, counted)).toEqual({ kind: "unreadable", error: "no_file" });
    expect(await runQuickCheck(db, "u", new Blob(["not a picture"]), ai, counted)).toEqual({ kind: "unreadable", error: "not_image" });
    const big = new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)]);
    expect(await runQuickCheck(db, "u", big, ai, counted)).toEqual({ kind: "unreadable", error: "too_large" });
    const tiny = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    expect(await runQuickCheck(db, "u", new Blob([new Uint8Array(tiny)]), ai, counted)).toEqual({ kind: "unreadable", error: "too_small" });
    expect(ai.extract).not.toHaveBeenCalled();
    expect(actions).toEqual([]);
  });

  it("takes a JPEG, as the Shortcut sends it", async () => {
    const { ai, counted } = setup(extracted({ recognized: false }));
    const jpeg = await sharp(await fakeScreenshot()).jpeg().toBuffer();
    await runQuickCheck(db, "u", new Blob([new Uint8Array(jpeg)]), ai, counted);
    expect(ai.extract).toHaveBeenCalledWith(
      expect.objectContaining({ screenshot: expect.objectContaining({ kind: "inline", mime: "image/jpeg" }), images: [] }),
    );
  });

  it("counts a read, then stops when no product was spotted", async () => {
    const { ai, counted, actions } = setup(extracted({ recognized: false }));
    expect(await runQuickCheck(db, "u", await shot(), ai, counted)).toEqual({ kind: "unreadable", error: "unrecognized" });
    expect(actions).toEqual(["read"]);
  });

  it("turns an accessory away with its cleaned name, and gives the check's count back", async () => {
    const { ai, counted, actions, givenBack } = setup();
    expect(await runQuickCheck(db, "u", await shot(), ai, counted)).toEqual({
      kind: "accessory",
      title: "Canvas Tote",
      category: "accessory",
      message: ACCESSORY_NOTICE,
    });
    expect(actions).toEqual(["read", "check"]);
    expect(givenBack).toEqual(["check"]);
    expect(ai.judge).not.toHaveBeenCalled();
    expect(ai.score).not.toHaveBeenCalled();
    expect(ai.repeat).not.toHaveBeenCalled();
  });

  it("lets a used-up daily limit through to the route", async () => {
    const { ai } = setup();
    const over: Counted = async () => {
      throw new AiDailyLimitError("read", 60);
    };
    await expect(runQuickCheck(db, "u", await shot(), ai, over)).rejects.toBeInstanceOf(AiDailyLimitError);
    expect(ai.extract).not.toHaveBeenCalled();
  });
});
