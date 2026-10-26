import { describe, expect, it } from "vitest";
import type { FeelingStructured } from "@/lib/ai/schemas/common";
import { mergeFeeling } from "./feeling-merge";

const OLD: FeelingStructured = {
  flattering: "yes",
  liked: "yes",
  bodyAreas: [
    { area: "waist", sentiment: "positive" },
    { area: "hips", sentiment: "positive" },
  ],
  occasions: ["work"],
  mood: ["confident"],
  summary: "Flattering, wears it to work.",
};

const EMPTY: FeelingStructured = {
  flattering: "unknown",
  liked: "unknown",
  bodyAreas: [],
  occasions: [],
  mood: [],
  summary: "",
};

describe("mergeFeeling", () => {
  it("takes the new answer where the new text says something different", () => {
    const merged = mergeFeeling(OLD, {
      ...EMPTY,
      liked: "no",
      bodyAreas: [{ area: "Hips", sentiment: "negative" }],
      summary: "Tight on the hips now.",
    });
    expect(merged.liked).toBe("no");
    expect(merged.bodyAreas).toEqual([
      { area: "waist", sentiment: "positive" },
      { area: "Hips", sentiment: "negative" },
    ]);
    expect(merged.summary).toBe("Tight on the hips now.");
  });

  it("keeps old answers the new text does not mention", () => {
    const merged = mergeFeeling(OLD, { ...EMPTY, occasions: ["social", "Work"], mood: ["cozy"] });
    expect(merged).toEqual({
      ...OLD,
      occasions: ["social", "Work"],
      mood: ["cozy", "confident"],
    });
  });

  it("uses the new fields as they are when there is nothing valid to merge with", () => {
    const next = { ...EMPTY, liked: "yes" as const };
    expect(mergeFeeling(null, next)).toEqual(next);
    expect(mergeFeeling({ flattering: "maybe" }, next)).toEqual(next);
  });
});
