// Inputs for the recorded live calls. The recorder (live.record.ts) sends
// them to the real model once; lib/ai/live/replay.test.ts replays the saved
// answers for free. Changing an input or a PROMPT_VERSION needs a new recording.
import type { ItemSummary } from "@/lib/ai/schemas/common";
import type { JudgePairingInput } from "@/lib/ai/schemas/judge-pairing";
import type { ParseFeelingInput } from "@/lib/ai/schemas/parse-feeling";
import judgeTwenty from "./judge-pairing-20.json";

// The seed persona's three items (seed/items.json).
export const SHIRT: ItemSummary = {
  id: "852c8e3d-abf7-4955-ab65-9d83194a02ae",
  title: "White cotton button-down",
  tags: {
    category: "top",
    colors: [{ name: "white" }],
    colorFamily: "white",
    materials: ["cotton"],
    fit: "regular",
    formality: 3,
    tempRangeF: { min: 55, max: 85 },
    occasions: ["work", "social"],
  },
};
export const JEANS: ItemSummary = {
  id: "c81b2b56-1f62-4284-83b6-7307a6355ac5",
  title: "Dark straight-leg jeans",
  tags: {
    category: "bottom",
    colors: [{ name: "indigo" }],
    colorFamily: "denim",
    materials: ["denim"],
    fit: "regular",
    formality: 2,
    tempRangeF: { min: 40, max: 80 },
    occasions: ["work", "social"],
  },
};
export const SNEAKERS: ItemSummary = {
  id: "23c59091-9b18-4c24-92c3-1072a5581d8e",
  title: "White leather sneakers",
  tags: {
    category: "shoes",
    colors: [{ name: "white" }],
    colorFamily: "white",
    materials: ["leather"],
    formality: 2,
    tempRangeF: { min: 40, max: 90 },
    occasions: ["social", "home"],
  },
};

export const FEELING_CASES: { name: string; input: ParseFeelingInput }[] = [
  {
    name: "likes it, tight shoulders",
    input: {
      item: SHIRT,
      text: "Love this shirt, so comfy and the color makes me look awake. A bit tight across the shoulders though.",
    },
  },
  {
    name: "never wears it",
    input: {
      item: JEANS,
      text: "Never wear these. The waist digs in when I sit and they make my legs look short.",
    },
  },
  {
    name: "says nothing about looks",
    input: { item: SNEAKERS, text: "Wore them to brunch and a long walk, no complaints." },
  },
  {
    name: "chinese note",
    input: { item: SHIRT, text: "版型很好，显瘦，就是领口有点紧，上班穿刚好" },
  },
];

export const PAIRING_CASES: { name: string; input: JudgePairingInput }[] = [
  {
    name: "seed closet, 3 pairs",
    input: {
      pairs: [
        { a: SHIRT, b: JEANS },
        { a: SHIRT, b: SNEAKERS },
        { a: JEANS, b: SNEAKERS },
      ],
    },
  },
  {
    // First 20 rule-approved pairs of lib/check/fixtures.ts SAMPLE_CLOSET,
    // frozen so later fixture edits do not invalidate the recording.
    name: "sample closet, 20 pairs",
    input: judgeTwenty as JudgePairingInput,
  },
];
