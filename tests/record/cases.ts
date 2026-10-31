// Inputs for the recorded live calls. The recorder (live.record.ts) sends
// them to the real model once; lib/ai/live/replay.test.ts replays the saved
// answers for free. Changing an input or a PROMPT_VERSION needs a new recording.
import type { BuildProfileInput } from "@/lib/ai/schemas/build-profile";
import type { SummarizeWearInput } from "@/lib/ai/schemas/summarize-wear";
import type { FeelingStructured, ItemSummary, MediaRef } from "@/lib/ai/schemas/common";
import type { JudgePairingInput } from "@/lib/ai/schemas/judge-pairing";
import type { JudgeRepeatInput } from "@/lib/ai/schemas/judge-repeat";
import type { ParseFeelingInput } from "@/lib/ai/schemas/parse-feeling";
import { MAX_FELT_PHOTOS, type FeltFeeling, type ScorePurchaseInput } from "@/lib/ai/schemas/score-purchase";
import { readFileSync } from "node:fs";
import judgeTwenty from "./judge-pairing-20.json";
import photoCloset from "./score-photo-closet.json";

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

// The persona's closet with photos (local seed, frozen 10-30): two of its
// pieces are the candidates, the other fifteen active ones are felt items.
// tests/record/score-photo-closet.json holds the tags, feelings and the
// felt items in lib/check's order; fixtures/images/score/ the photos, as
// lib/check shrinks them (score-photos.ts).
type PhotoClosetItem = ItemSummary & { feeling: FeelingStructured };
const PHOTO_CLOSET = photoCloset.closet as PhotoClosetItem[];

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
  {
    name: "the persona's fifteen pieces on 10-30, for the photo cases",
    input: {
      items: PHOTO_CLOSET.map(({ id, title, tags }) => ({ id, title, tags })),
      feelings: PHOTO_CLOSET.map(({ id, feeling }) => ({ ...feeling, itemId: id })),
    },
  },
];

// The same two candidates scored against the seven-piece closet with the
// style card recorded for it (fixtures/ai/buildProfile, occasion left out),
// so the card and the felt items come from the same feelings, as in the app.
// Without a card they're only run by hand, to compare.
const SEVEN_FEELINGS = PROFILE_CASES[0].input.feelings;
const feltIn = (item: ItemSummary) => {
  const found = SEVEN_FEELINGS.find((f) => f.itemId === item.id);
  if (!found) throw new Error(`no feeling for ${item.id}`);
  const { flattering, liked, aspects, mood, summary } = found;
  return { ...item, feeling: { flattering, liked, aspects, mood, summary } };
};
const SEVEN_STYLE: NonNullable<ScorePurchaseInput["styleProfile"]> = [
  { topic: "color", kind: "suits", text: "Crisp white and soft neutrals brighten you" },
  { topic: "color", kind: "avoid", text: "Mustard yellow washes you out" },
  { topic: "fit", kind: "suits", text: "Relaxed cuts with roomy stretchy waistbands suit you" },
  { topic: "fit", kind: "avoid", text: "Clingy slim fits and tight waistbands restrict you" },
  { topic: "feel", kind: "suits", text: "Soft cotton keeps you comfortable" },
  { topic: "feel", kind: "avoid", text: "Scratchy wool feels uncomfortable on you" },
  { topic: "length", kind: "suits", text: "Full-length hems create a longer leg line for you" },
  { topic: "length", kind: "avoid", text: "Cropped lengths ride up on you" },
  { topic: "style", kind: "suits", text: "Polished staples like trousers and button-downs suit you" },
];
const SEVEN_TROUBLE = ["hips", "shoulders", "waist"];

export const STYLED_SCORE_CASES: { name: string; input: ScorePurchaseInput }[] = [
  {
    name: "seven pieces with a style card, high-waisted wide-leg trousers",
    input: {
      candidate: TROUSERS,
      profile: SEED_PROFILE,
      feltItems: [PROFILE_TROUSERS, JEANS, PROFILE_TEE, PROFILE_SWEATER, PROFILE_DRESS, SHIRT, SNEAKERS].map(feltIn),
      troubleAreas: SEVEN_TROUBLE,
      questions: FIT_QUESTIONS_1026,
      styleProfile: SEVEN_STYLE,
    },
  },
  {
    name: "seven pieces with a style card, slim cropped boat-neck top",
    input: {
      candidate: CROPPED_TOP,
      profile: SEED_PROFILE,
      feltItems: [PROFILE_TEE, PROFILE_SWEATER, SHIRT, PROFILE_TROUSERS, PROFILE_DRESS, JEANS, SNEAKERS].map(feltIn),
      troubleAreas: SEVEN_TROUBLE,
      questions: FIT_QUESTIONS_1026,
      styleProfile: SEVEN_STYLE,
    },
  },
];

// 30 days of outfits over the seven-piece closet: a praised dress worn once,
// knocked jeans worn 11 times, a sweater never worn, and sport always in the
// same outfit though three are wanted.
const pick = ({ flattering, liked, aspects }: FeltFeeling) => ({ flattering, liked, aspects });
const worn = (item: ItemSummary, wornCount: number, lastWornDaysAgo: number | null, feeling: FeltFeeling | null = null) => ({
  ...item,
  wornCount,
  lastWornDaysAgo,
  addedDaysAgo: null,
  feeling: feeling && pick(feeling),
});

export const WEAR_CASES: { name: string; input: SummarizeWearInput }[] = [
  {
    name: "thirty days, say vs wear and a short occasion",
    input: {
      windowDays: 30,
      loggedDays: 26,
      outfitCount: 31,
      items: [
        worn(SHIRT, 3, 9, SHIRT_FEELING),
        worn(JEANS, 11, 0, JEANS_FEELING),
        worn(SNEAKERS, 14, 1, SNEAKERS_FEELING),
        worn(PROFILE_TROUSERS, 9, 2, {
          flattering: "yes",
          liked: "yes",
          aspects: [{ aspect: "fit", sentiment: "positive", area: "waist", said: "the elastic back never digs in", means: "stretchy waistbands work" }],
          mood: [],
          summary: "",
        }),
        worn(PROFILE_TEE, 6, 3),
        worn(PROFILE_SWEATER, 0, null),
        worn(PROFILE_DRESS, 1, 24, {
          flattering: "yes",
          liked: "yes",
          aspects: [{ aspect: "color", sentiment: "positive", said: "the mustard makes me glow", means: "warm yellows suit you" }],
          mood: ["confident"],
          summary: "",
        }),
      ],
      occasions: [
        { occasion: "school", wanted: 3, outfitsLogged: 18, distinctOutfits: 6 },
        { occasion: "social", wanted: 2, outfitsLogged: 2, distinctOutfits: 2 },
        { occasion: "sport", wanted: 3, outfitsLogged: 5, distinctOutfits: 1 },
      ],
    },
  },
];

const photo = (id: string): MediaRef => ({
  kind: "inline",
  mime: "image/webp",
  base64: readFileSync(new URL(`../../fixtures/images/score/${id}.webp`, import.meta.url)).toString("base64"),
});

// The style card buildProfile wrote for the fifteen pieces
// (fixtures/ai/buildProfile), occasion left out.
const PHOTO_STYLE: NonNullable<ScorePurchaseInput["styleProfile"]> = [
  { topic: "color", kind: "suits", text: "Pink and rich neutrals brighten you best" },
  { topic: "color", kind: "avoid", text: "Skip beige tones washing you out" },
  { topic: "fit", kind: "suits", text: "Slim fitted tops and relaxed wide or oversized bottoms suit you" },
  { topic: "fit", kind: "avoid", text: "Avoid deep V-necks and tight jacket shoulders" },
  { topic: "feel", kind: "suits", text: "Soft sweat-wicking and fleece fabrics keep you comfortable" },
  { topic: "feel", kind: "avoid", text: "Skip uncomfortable plain cotton tops" },
  { topic: "style", kind: "suits", text: "Casual hoodies, sneakers and loafers suit you daily" },
];

function photoCase(index: number, withCard: boolean): ScorePurchaseInput {
  const { candidateId, feltIds, troubleAreas, questions } = photoCloset.cases[index];
  const candidate = (photoCloset.candidates as ItemSummary[]).find((c) => c.id === candidateId)!;
  const felt = feltIds.map((id) => PHOTO_CLOSET.find((c) => c.id === id)!);
  return {
    candidate: { ...candidate, photo: photo(candidate.id) },
    profile: SEED_PROFILE,
    feltItems: felt.map(({ feeling, ...item }, i) => {
      const { flattering, liked, aspects, mood, summary } = feeling;
      return { ...item, feeling: { flattering, liked, aspects, mood, summary }, ...(i < MAX_FELT_PHOTOS && { photo: photo(item.id) }) };
    }),
    troubleAreas,
    questions,
    ...(withCard && { styleProfile: PHOTO_STYLE }),
  };
}

// With photos, as lib/check sends them: the candidate's and the closest
// MAX_FELT_PHOTOS felt items'.
export const PHOTO_SCORE_CASES: { name: string; input: ScorePurchaseInput }[] = [
  { name: "persona with photos, pink fitted tech tee", input: photoCase(0, false) },
  { name: "persona with photos, gray cropped baby tee", input: photoCase(1, false) },
  { name: "persona with photos and a style card, pink fitted tech tee", input: photoCase(0, true) },
  { name: "persona with photos and a style card, gray cropped baby tee", input: photoCase(1, true) },
];
