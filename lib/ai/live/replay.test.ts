// Replays the real answers recorded by tests/record/live.record.ts. No
// network and no cost; a miss means the case or PROMPT_VERSION changed
// without a new recording.
import { describe, expect, it } from "vitest";
import { FEELING_CASES, PAIRING_CASES, REPEAT_CASES, SCORE_CASES } from "@/tests/record/cases";
import { judgePairing, judgeRepeat, parseFeeling, scorePurchase } from "../index";

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
  const score = (name: string) => {
    const found = SCORE_CASES.find((c) => c.name === name);
    if (!found) throw new Error(`no case ${name}`);
    return scorePurchase(found.input, REPLAY);
  };
  const scoreOf = (out: Awaited<ReturnType<typeof score>>, id: string) => out.answers.find((a) => a.id === id)?.score;

  it.each(SCORE_CASES.map((c) => [c.name, c.input] as const))(
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
