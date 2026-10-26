// Replays the real answers recorded by tests/record/live.record.ts. No
// network and no cost; a miss means the case or PROMPT_VERSION changed
// without a new recording.
import { describe, expect, it } from "vitest";
import { FEELING_CASES, PAIRING_CASES } from "@/tests/record/cases";
import { judgePairing, parseFeeling } from "../index";

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
    expect(out.liked).toBe("yes");
    expect(out.bodyAreas).toContainEqual({ area: "shoulders", sentiment: "negative" });
  });

  it("picks up jeans that dig in and look bad", async () => {
    const out = await feeling("never wears it");
    expect(out.liked).toBe("no");
    expect(out.flattering).toBe("no");
    expect(out.bodyAreas).toContainEqual({ area: "waist", sentiment: "negative" });
  });

  it("leaves flattering unknown when the note says nothing about looks", async () => {
    const out = await feeling("says nothing about looks");
    expect(out.flattering).toBe("unknown");
    expect(out.bodyAreas).toEqual([]);
  });

  it("reads a Chinese note and still summarizes in English", async () => {
    const out = await feeling("chinese note");
    expect(out.flattering).toBe("yes");
    expect(out.bodyAreas).toContainEqual({ area: "neckline", sentiment: "negative" });
    expect(out.summary).toMatch(/^[\x20-\x7e]+$/);
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
