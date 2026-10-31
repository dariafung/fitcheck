// Replays the real answers recorded by tests/record/live.record.ts. No
// network and no cost; a miss means the case or PROMPT_VERSION changed
// without a new recording.
import { describe, expect, it } from "vitest";
import {
  FEELING_CASES,
  PAIRING_CASES,
  PHOTO_SCORE_CASES,
  PROFILE_CASES,
  REPEAT_CASES,
  SCORE_CASES,
  STYLED_SCORE_CASES,
  WEAR_CASES,
} from "@/tests/record/cases";
import { BuildProfileInput, HEADLINE_MAX_WORDS, profileFacts, STATEMENT_MAX_WORDS } from "../schemas/build-profile";
import { INSIGHT_MAX_WORDS, SummarizeWearInput } from "../schemas/summarize-wear";
import { buildProfile, judgePairing, judgeRepeat, parseFeeling, scorePurchase, summarizeWear } from "../index";
import { retells } from "./build-profile";

const REPLAY = { mode: "replay" } as const;
const feeling = (name: string) => {
  const found = FEELING_CASES.find((c) => c.name === name);
  if (!found) throw new Error(`no case ${name}`);
  return parseFeeling(found.input, REPLAY);
};
const words = (text: string) => text.trim().split(/\s+/).length;

describe("parseFeeling recordings", () => {
  it("picks up a liked shirt that is tight in the shoulders", async () => {
    const out = await feeling("likes it, tight shoulders");
    // Loves it but the shoulders are tight: either reading is fair.
    expect(["yes", "mixed"]).toContain(out.liked);
    expect(out.aspects).toContainEqual(expect.objectContaining({ aspect: "fit", area: "shoulders", sentiment: "negative" }));
  });

  it("picks up jeans that dig in and look bad", async () => {
    const out = await feeling("never wears it");
    expect(out.liked).toBe("no");
    expect(out.flattering).toBe("no");
    expect(out.aspects).toContainEqual(expect.objectContaining({ aspect: "fit", area: "waist", sentiment: "negative" }));
  });

  it("leaves flattering unknown when the note says nothing about looks", async () => {
    const out = await feeling("says nothing about looks");
    expect(out.flattering).toBe("unknown");
    expect(out.aspects.filter((a) => a.aspect === "fit" || a.aspect === "color")).toEqual([]);
  });

  it("reads a Chinese note and still summarizes in English", async () => {
    const out = await feeling("chinese note");
    expect(out.flattering).toBe("yes");
    expect(out.aspects).toContainEqual(expect.objectContaining({ aspect: "fit", area: "neckline", sentiment: "negative" }));
    expect(out.summary).toMatch(/^[\x20-\x7e]+$/);
  });

  it("splits color and length into their own aspects", async () => {
    const out = await feeling("good color, too short");
    expect(out.aspects).toContainEqual(expect.objectContaining({ aspect: "color", sentiment: "positive" }));
    expect(out.aspects).toContainEqual(expect.objectContaining({ aspect: "length", sentiment: "negative" }));
  });

  it("keeps what was said and what it means short, and areas on fit only", async () => {
    for (const { input } of FEELING_CASES) {
      const { aspects } = await parseFeeling(input, REPLAY);
      for (const a of aspects) {
        expect(words(a.said)).toBeLessThanOrEqual(8);
        expect(words(a.means)).toBeLessThanOrEqual(8);
        if (a.aspect !== "fit") expect(a.area).toBeUndefined();
      }
    }
  });

  it("keeps summaries short and free of gendered pronouns", async () => {
    for (const { input } of FEELING_CASES) {
      const { summary } = await parseFeeling(input, REPLAY);
      expect(words(summary)).toBeLessThanOrEqual(20);
      expect(summary).not.toMatch(/\b(she|her|hers|he|him|his)\b/i);
    }
  });
});

describe("judgePairing recordings", () => {
  it.each(PAIRING_CASES.map((c) => [c.name, c.input] as const))(
    "%s: answers every pair once with a short reason",
    async (_, input) => {
      const out = await judgePairing(input, REPLAY);
      const asked = input.pairs.map(({ a, b }) => `${a.id}+${b.id}`);
      expect(out.results.map((r) => `${r.aId}+${r.bId}`)).toEqual(asked);
      for (const r of out.results) expect(words(r.reason)).toBeLessThanOrEqual(15);
    },
  );
});

describe("scorePurchase recordings", () => {
  const ALL_SCORE_CASES = [...SCORE_CASES, ...STYLED_SCORE_CASES, ...PHOTO_SCORE_CASES];
  const score = (name: string) => {
    const found = ALL_SCORE_CASES.find((c) => c.name === name);
    if (!found) throw new Error(`no case ${name}`);
    return scorePurchase(found.input, REPLAY);
  };
  const scoreOf = (out: Awaited<ReturnType<typeof score>>, id: string) => out.answers.find((a) => a.id === id)?.score;

  it.each(ALL_SCORE_CASES.map((c) => [c.name, c.input] as const))(
    "%s: answers every question once, in order, with short reasons and no numbers",
    async (_, input) => {
      const out = await scorePurchase(input, REPLAY);
      expect(out.answers.map((a) => a.id)).toEqual(input.questions.map((q) => q.id));
      for (const a of out.answers) {
        expect(words(a.reason)).toBeLessThanOrEqual(20);
        expect(a.reason).not.toMatch(/\b(she|her|hers|he|him|his)\b|\d+\s*(\/|%|points?)/i);
      }
      expect(words(out.summary)).toBeLessThanOrEqual(25);
    },
  );

  it("scores a slim cropped boat-neck low for someone tight in the shoulders and waist", async () => {
    const out = await score("seed persona, slim cropped boat-neck top");
    expect(scoreOf(out, "cut_flatters")).toBeLessThanOrEqual(3);
    expect(scoreOf(out, "spares_trouble_areas")).toBeLessThanOrEqual(3);
  });

  it("scores roomy full-length trousers high after jeans that dug in and cut the leg line", async () => {
    const out = await score("seed persona, high-waisted wide-leg trousers");
    expect(scoreOf(out, "cut_flatters")).toBeGreaterThanOrEqual(6);
  });

  it("stays neutral on colors nobody said anything about", async () => {
    for (const { input } of SCORE_CASES) {
      expect(scoreOf(await scorePurchase(input, REPLAY), "color_liked")).toBe(4);
    }
  });

  it("with the style card, still scores the cropped top low and the trousers high", async () => {
    const top = await score("seven pieces with a style card, slim cropped boat-neck top");
    expect(scoreOf(top, "cut_flatters")).toBeLessThanOrEqual(3);
    expect(scoreOf(top, "spares_trouble_areas")).toBeLessThanOrEqual(3);
    // The mustard dress washed their face out.
    expect(scoreOf(top, "color_liked")).toBeLessThanOrEqual(3);
    const trousers = await score("seven pieces with a style card, high-waisted wide-leg trousers");
    expect(scoreOf(trousers, "cut_flatters")).toBeGreaterThanOrEqual(6);
  });

  it("with photos, scores the pink fitted tee above the gray cropped tee, card or not", async () => {
    const total = (out: Awaited<ReturnType<typeof score>>) => out.answers.reduce((sum, a) => sum + a.score, 0);
    for (const prefix of ["persona with photos", "persona with photos and a style card"]) {
      const pink = await score(`${prefix}, pink fitted tech tee`);
      expect(scoreOf(pink, "color_liked")).toBeGreaterThanOrEqual(6);
      expect(total(pink)).toBeGreaterThan(total(await score(`${prefix}, gray cropped baby tee`)));
    }
  });

  it.each(
    [...STYLED_SCORE_CASES, ...PHOTO_SCORE_CASES]
      .filter((c) => c.input.styleProfile)
      .map((c) => [c.name, c.input] as const),
  )(
    "%s: doesn't quote the style card",
    async (_, input) => {
      const out = await scorePurchase(input, REPLAY);
      // Any four words in a row from a card line.
      const runs = (input.styleProfile ?? []).flatMap(({ text }) => {
        const w = text.toLowerCase().split(/\s+/);
        return w.slice(0, -3).map((_, i) => w.slice(i, i + 4).join(" "));
      });
      for (const text of [...out.answers.map((a) => a.reason), out.summary]) {
        const said = text.toLowerCase().replace(/[^a-z\s-]/g, "").split(/\s+/).join(" ");
        for (const run of runs) expect(said).not.toContain(run);
      }
    },
  );
});

describe("judgeRepeat recordings", () => {
  const repeat = (name: string) => {
    const found = REPEAT_CASES.find((c) => c.name === name);
    if (!found) throw new Error(`no case ${name}`);
    return judgeRepeat(found.input, REPLAY);
  };
  const titleOf = (id: string | null) => REPEAT_CASES[0].input.closet.find((i) => i.id === id)?.title;

  it.each(REPEAT_CASES.map((c) => [c.name, c.input] as const))(
    "%s: names an owned item, with a short reason and no numbers",
    async (_, input) => {
      const out = await judgeRepeat(input, REPLAY);
      expect(input.closet.map((i) => i.id)).toContain(out.closestId);
      expect(words(out.reason)).toBeLessThanOrEqual(15);
      expect(out.reason).not.toMatch(/\d/);
    },
  );

  it("flags a second white button-down", async () => {
    const out = await repeat("sample closet, white oxford shirt");
    expect(out.score).toBeLessThanOrEqual(2);
    expect(titleOf(out.closestId)).toBe("White cotton button-down");
  });

  it("lets other colors and cuts through", async () => {
    expect((await repeat("sample closet, navy wide-leg trousers")).score).toBeGreaterThanOrEqual(6);
    expect((await repeat("sample closet, mustard cropped top")).score).toBeGreaterThanOrEqual(7);
  });

});

describe("buildProfile recordings", () => {
  it.each(PROFILE_CASES.map((c) => [c.name, BuildProfileInput.parse(c.input)] as const))(
    "%s: covers every topic in short summaries that cite real items",
    async (_, input) => {
      const out = await buildProfile(input, REPLAY);
      const facts = profileFacts(input);
      const statements = [...out.suits, ...out.avoid];
      expect(new Set(statements.map((s) => s.topic))).toEqual(new Set(facts.topics));
      expect(out.avoid.length).toBeGreaterThan(0);

      const ids = new Set(input.items.map((i) => i.id));
      const saids = input.feelings.flatMap((f) => f.aspects.map((a) => a.said));
      expect(out.headline.evidenceItemIds.length).toBeGreaterThanOrEqual(2);
      expect(words(out.headline.text)).toBeLessThanOrEqual(HEADLINE_MAX_WORDS);
      for (const s of [out.headline, ...statements]) {
        for (const id of s.evidenceItemIds) expect(ids).toContain(id);
        expect(retells(s.text, saids), s.text).toBe(false);
        expect(s.text).not.toMatch(/\b(she|her|hers|he|him|his)\b/i);
      }
      for (const s of statements) expect(words(s.text)).toBeLessThanOrEqual(STATEMENT_MAX_WORDS);

      // Things to skip rest on items felt bad about.
      const negative = new Set(
        input.feelings
          .filter((f) => f.flattering === "no" || f.liked === "no" || f.aspects.some((a) => a.sentiment === "negative"))
          .map((f) => f.itemId),
      );
      for (const s of out.avoid) expect(s.evidenceItemIds.some((id) => negative.has(id)), s.text).toBe(true);
    },
  );
});

describe("summarizeWear recordings", () => {
  it.each(WEAR_CASES.map((c) => [c.name, SummarizeWearInput.parse(c.input)] as const))(
    "%s: short insights about real items, saying vs wearing first",
    async (_, input) => {
      const out = await summarizeWear(input, REPLAY);
      const ids = new Set(input.items.map((i) => i.id));
      expect(out.insights[0].kind).toBe("say_vs_wear");
      for (const insight of out.insights) {
        expect(words(insight.text)).toBeLessThanOrEqual(INSIGHT_MAX_WORDS);
        expect(insight.text).not.toMatch(/\b(she|her|hers|he|him|his)\b|%|\bI\d/i);
        for (const id of insight.itemIds) expect(ids.has(id)).toBe(true);
      }
    },
  );
});
