import { describe, expect, it } from "vitest";
import type { FeelingStructured } from "@/lib/ai/schemas/common";
import { mergeFeeling } from "./feeling-merge";

const OLD: FeelingStructured = {
  flattering: "yes",
  liked: "yes",
  aspects: [
    { aspect: "fit", sentiment: "positive", area: "waist", said: "nice at the waist", means: "defined waist suits them" },
    { aspect: "fit", sentiment: "positive", area: "hips", said: "smooth over the hips", means: "skims the hips" },
    { aspect: "color", sentiment: "positive", said: "love the green", means: "green suits them" },
  ],
  occasions: ["work"],
  mood: ["confident"],
  summary: "Flattering, wears it to work.",
};

const EMPTY: FeelingStructured = {
  flattering: "unknown",
  liked: "unknown",
  aspects: [],
  occasions: [],
  mood: [],
  summary: "",
};

describe("mergeFeeling", () => {
  it("takes the new answer where the new text says something different", () => {
    const merged = mergeFeeling(OLD, {
      ...EMPTY,
      liked: "no",
      aspects: [{ aspect: "fit", sentiment: "negative", area: "Hips", said: "tight on the hips", means: "hips need room" }],
      summary: "Tight on the hips now.",
    });
    expect(merged.liked).toBe("no");
    expect(merged.aspects).toEqual([
      OLD.aspects[0],
      { aspect: "fit", sentiment: "negative", area: "Hips", said: "tight on the hips", means: "hips need room" },
      OLD.aspects[2],
    ]);
    expect(merged.summary).toBe("Tight on the hips now.");
  });

  it("matches aspects without an area by what was said", () => {
    const merged = mergeFeeling(OLD, {
      ...EMPTY,
      aspects: [{ aspect: "color", sentiment: "negative", said: "Love the green ", means: "faded now" }],
    });
    expect(merged.aspects).toHaveLength(3);
    expect(merged.aspects[2]).toMatchObject({ aspect: "color", sentiment: "negative" });
  });

  it("keeps old answers the new text does not mention", () => {
    const merged = mergeFeeling(OLD, { ...EMPTY, occasions: ["social", "Work"], mood: ["cozy"] });
    expect(merged).toEqual({
      ...OLD,
      occasions: ["social", "Work"],
      mood: ["cozy", "confident"],
    });
  });

  it("reads feelings parsed before aspects existed and drops their body areas", () => {
    const legacy = {
      flattering: "yes",
      liked: "no",
      bodyAreas: [{ area: "hips", sentiment: "negative" }],
      occasions: ["work"],
      mood: [],
      summary: "Old one.",
    };
    const merged = mergeFeeling(legacy, EMPTY);
    expect(merged).toEqual({ ...EMPTY, flattering: "yes", liked: "no", occasions: ["work"], summary: "Old one." });
    expect(merged).not.toHaveProperty("bodyAreas");
  });

  it("uses the new fields as they are when there is nothing valid to merge with", () => {
    const next = { ...EMPTY, liked: "yes" as const };
    expect(mergeFeeling(null, next)).toEqual(next);
    expect(mergeFeeling({ flattering: "maybe" }, next)).toEqual(next);
  });
});
