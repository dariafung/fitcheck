// Inputs for the recorded live calls. The recorder (live.record.ts) sends
// them to the real model once; lib/ai/live/replay.test.ts replays the saved
// answers for free. Changing an input or a PROMPT_VERSION needs a new recording.
import type { BuildProfileInput } from "@/lib/ai/schemas/build-profile";
import type { ItemSummary } from "@/lib/ai/schemas/common";
import type { JudgePairingInput } from "@/lib/ai/schemas/judge-pairing";
import type { JudgeRepeatInput } from "@/lib/ai/schemas/judge-repeat";
import type { ParseFeelingInput } from "@/lib/ai/schemas/parse-feeling";
import type { FeltFeeling, ScorePurchaseInput } from "@/lib/ai/schemas/score-purchase";
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
  {
    name: "good color, too short",
    input: { item: SHIRT, text: "Love the color on me, but it's too short and rides up when I lift my arms." },
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

// The seed persona's feelings (seed/feelings.json) and profile
// (seed/persona.json), frozen like the items above.
const SHIRT_FEELING: FeltFeeling = {
  flattering: "yes",
  liked: "yes",
  aspects: [
    { aspect: "feel", sentiment: "positive", said: "so comfy", means: "so comfy" },
    { aspect: "color", sentiment: "positive", said: "color makes me look awake", means: "looks awake in white" },
    {
      aspect: "fit",
      sentiment: "negative",
      area: "shoulders",
      said: "tight across the shoulders",
      means: "shoulders need more room",
    },
  ],
  mood: [],
  summary: "Comfy white shirt looks awake but tight across shoulders.",
};
const JEANS_FEELING: FeltFeeling = {
  flattering: "no",
  liked: "no",
  aspects: [
    {
      aspect: "fit",
      sentiment: "negative",
      area: "waist",
      said: "waist digs in when I sit",
      means: "needs roomier waist for sitting",
    },
    { aspect: "length", sentiment: "negative", said: "make my legs look short", means: "needs longer-looking leg line" },
  ],
  mood: [],
  summary: "Unworn jeans dig at the waist and shorten the leg line.",
};
const SNEAKERS_FEELING: FeltFeeling = {
  flattering: "unknown",
  liked: "unknown",
  aspects: [],
  mood: [],
  summary: "White leather sneakers worn to brunch and long walk without complaints.",
};
const SEED_PROFILE: ScorePurchaseInput["profile"] = {
  bodyShape: "pear",
  heightCm: 165,
  lifestyleMix: { work: 0, school: 3, social: 2, sport: 3, home: 3 },
};
const FELT = {
  shirt: { ...SHIRT, feeling: SHIRT_FEELING },
  jeans: { ...JEANS, feeling: JEANS_FEELING },
  sneakers: { ...SNEAKERS, feeling: SNEAKERS_FEELING },
};
// lib/check/fit-questions.ts on 10-26; the seed feelings give every one a basis.
const FIT_QUESTIONS_1026 = [
  {
    id: "cut_flatters",
    text: "Is its cut, fit and length like the felt items the user says flatter them or fit well, and unlike the ones that don't?",
  },
  { id: "spares_trouble_areas", text: "Does it avoid drawing attention to the body areas listed in troubleAreas?" },
  {
    id: "color_liked",
    text: "Is its color like the colors the user felt good about, and unlike the ones they felt bad about?",
  },
  {
    id: "style_liked",
    text: "Is its style (formality, pattern, kind of piece) like the felt items the user likes, and unlike the ones they don't?",
  },
  {
    id: "feel_liked",
    text: "Would its material and feel likely suit what the user says about how their clothes feel, good and bad?",
  },
];
// Made-up candidates; felt items in lib/check's pickFeltItems order (same
// category first, then ones with aspects, then by id).
const CANDIDATE_ID = "00000000-0000-4000-8000-000000000000";
const TROUSERS: ItemSummary = {
  id: CANDIDATE_ID,
  title: "Navy high-waisted wide-leg trousers",
  tags: {
    category: "bottom",
    subcategory: "trousers",
    colors: [{ name: "navy" }],
    colorFamily: "navy",
    materials: ["wool blend"],
    fit: "relaxed",
    formality: 3,
    tempRangeF: { min: 40, max: 75 },
    occasions: ["school", "work"],
    notes: "elastic back waist, full-length",
  },
};
const CROPPED_TOP: ItemSummary = {
  id: CANDIDATE_ID,
  title: "Mustard slim cropped boat-neck top",
  tags: {
    category: "top",
    colors: [{ name: "mustard" }],
    colorFamily: "yellow",
    pattern: "ribbed",
    materials: ["polyester", "elastane"],
    fit: "slim",
    formality: 2,
    tempRangeF: { min: 60, max: 85 },
    occasions: ["social"],
    notes: "cropped above the waist",
  },
};

export const SCORE_CASES: { name: string; input: ScorePurchaseInput }[] = [
  {
    name: "seed persona, high-waisted wide-leg trousers",
    input: {
      candidate: TROUSERS,
      profile: SEED_PROFILE,
      feltItems: [FELT.jeans, FELT.shirt, FELT.sneakers],
      troubleAreas: ["shoulders", "waist"],
      questions: FIT_QUESTIONS_1026,
    },
  },
  {
    name: "seed persona, slim cropped boat-neck top",
    input: {
      candidate: CROPPED_TOP,
      profile: SEED_PROFILE,
      feltItems: [FELT.shirt, FELT.jeans, FELT.sneakers],
      troubleAreas: ["shoulders", "waist"],
      questions: FIT_QUESTIONS_1026,
    },
  },
];

// The 17 distinct items of the 20 frozen sample-closet pairs above.
const SAMPLE_ITEMS: ItemSummary[] = [
  ...new Map((judgeTwenty as JudgePairingInput).pairs.flatMap(({ a, b }) => [a, b]).map((i) => [i.id, i])).values(),
];
const OXFORD_SHIRT: ItemSummary = {
  id: CANDIDATE_ID,
  title: "White oxford shirt",
  tags: {
    category: "top",
    subcategory: "button-down",
    colors: [{ name: "white" }],
    colorFamily: "white",
    materials: ["cotton"],
    fit: "regular",
    formality: 3,
    tempRangeF: { min: 55, max: 85 },
    occasions: ["work", "school"],
  },
};

export const REPEAT_CASES: { name: string; input: JudgeRepeatInput }[] = [
  { name: "sample closet, white oxford shirt", input: { candidate: OXFORD_SHIRT, closet: SAMPLE_ITEMS } },
  { name: "sample closet, navy wide-leg trousers", input: { candidate: TROUSERS, closet: SAMPLE_ITEMS } },
  { name: "sample closet, mustard cropped top", input: { candidate: CROPPED_TOP, closet: SAMPLE_ITEMS } },
];

// A seven-piece closet whose feelings cover color, fit, fabric and length,
// good and bad, so the style card has something for every topic.
const PROFILE_TROUSERS: ItemSummary = {
  id: "7a1e0c52-3b4d-4f6a-9c8e-1d2f3a4b5c01",
  title: "Navy wide-leg trousers",
  tags: {
    category: "bottom",
    subcategory: "trousers",
    colors: [{ name: "navy" }],
    colorFamily: "navy",
    materials: ["wool blend"],
    fit: "relaxed",
    formality: 3,
    occasions: ["school", "work"],
    notes: "elastic back waist, full-length",
  },
};
const PROFILE_TEE: ItemSummary = {
  id: "7a1e0c52-3b4d-4f6a-9c8e-1d2f3a4b5c02",
  title: "Black cropped boxy tee",
  tags: {
    category: "top",
    colors: [{ name: "black" }],
    colorFamily: "black",
    materials: ["cotton"],
    fit: "oversized",
    formality: 1,
    occasions: ["home", "sport"],
  },
};
const PROFILE_SWEATER: ItemSummary = {
  id: "7a1e0c52-3b4d-4f6a-9c8e-1d2f3a4b5c03",
  title: "Gray merino crewneck",
  tags: {
    category: "top",
    colors: [{ name: "heather gray" }],
    colorFamily: "gray",
    materials: ["merino wool"],
    fit: "regular",
    formality: 3,
    occasions: ["school", "work"],
  },
};
const PROFILE_DRESS: ItemSummary = {
  id: "7a1e0c52-3b4d-4f6a-9c8e-1d2f3a4b5c04",
  title: "Mustard ribbed midi dress",
  tags: {
    category: "one_piece",
    colors: [{ name: "mustard" }],
    colorFamily: "yellow",
    materials: ["viscose"],
    fit: "slim",
    formality: 3,
    occasions: ["social"],
  },
};

export const PROFILE_CASES: { name: string; input: BuildProfileInput }[] = [
  {
    name: "seven pieces, good and bad on every topic",
    input: {
      items: [SHIRT, JEANS, SNEAKERS, PROFILE_TROUSERS, PROFILE_TEE, PROFILE_SWEATER, PROFILE_DRESS],
      feelings: [
        { ...SHIRT_FEELING, itemId: SHIRT.id, occasions: ["school"] },
        { ...JEANS_FEELING, itemId: JEANS.id, occasions: [] },
        { ...SNEAKERS_FEELING, itemId: SNEAKERS.id, occasions: ["social", "sport"] },
        {
          itemId: PROFILE_TROUSERS.id,
          flattering: "yes",
          liked: "yes",
          aspects: [
            { aspect: "fit", sentiment: "positive", area: "waist", said: "the elastic back never digs in", means: "stretchy waistbands work" },
            { aspect: "length", sentiment: "positive", said: "full length makes my legs look long", means: "full-length hems lengthen legs" },
          ],
          occasions: ["school"],
          mood: ["put together"],
          summary: "Comfortable trousers that never dig in and lengthen the legs.",
        },
        {
          itemId: PROFILE_TEE.id,
          flattering: "mixed",
          liked: "yes",
          aspects: [
            { aspect: "feel", sentiment: "positive", said: "soft and easy", means: "soft cotton is comfortable" },
            { aspect: "length", sentiment: "negative", said: "too short when I lift my arms", means: "cropped tops ride up" },
          ],
          occasions: ["home"],
          mood: ["relaxed"],
          summary: "Soft tee that rides up when arms are raised.",
        },
        {
          itemId: PROFILE_SWEATER.id,
          flattering: "yes",
          liked: "mixed",
          aspects: [
            { aspect: "color", sentiment: "positive", said: "gray goes with everything", means: "soft neutrals are easy to wear" },
            { aspect: "feel", sentiment: "negative", said: "itchy at the neck", means: "scratchy wool bothers the skin" },
          ],
          occasions: ["school"],
          mood: [],
          summary: "Easy gray sweater that itches at the neck.",
        },
        {
          itemId: PROFILE_DRESS.id,
          flattering: "no",
          liked: "no",
          aspects: [
            { aspect: "color", sentiment: "negative", said: "mustard makes me look sick", means: "mustard washes the face out" },
            { aspect: "fit", sentiment: "negative", area: "hips", said: "clings to my hips", means: "clingy fits over the hips don't work" },
          ],
          occasions: ["social"],
          mood: ["self-conscious"],
          summary: "Mustard dress washes the face out and clings at the hips.",
        },
      ],
    },
  },
];
