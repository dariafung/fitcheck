// "Should I buy this?" for one candidate: compare the closet's outfits with
// and without it, have the model score the fit questions and how much it
// repeats the closet, add it all up in code.
// The candidate is never stored: not in items, not in pairings, not cached.
import {
  FeelingStructured,
  LifestyleMix,
  type Category,
  type ItemTags,
  type ProfileSummary,
} from "../ai/schemas/common";
import { AiOutputError } from "../ai/errors";
import type { JudgeRepeatInput, JudgeRepeatOutput } from "../ai/schemas/judge-repeat";
import {
  MAX_FELT_PHOTOS,
  type ScorePurchaseInput,
  type ScorePurchaseOutput,
  type StyleLine,
} from "../ai/schemas/score-purchase";
import { imageUrls } from "../closet/images";
import { loadStyleCardForScoring } from "../closet/style-profile";
import type { Db } from "../db/server";
import {
  FIT_QUESTIONS,
  fitAnswers,
  hasBasis,
  pickFeltItems,
  toFeltItem,
  toItemSummary,
  troubleAreas,
  type FitAnswer,
} from "./fit-questions";
import {
  gapKind,
  missingSlots,
  occasionGap,
  revivedItemIds,
  type GapKind,
  type MissingSlot,
  type OccasionChange,
  type OccasionGapTier,
} from "./gaps";
import type { JudgeFn } from "./judge";
import {
  CANDIDATE_ITEM_ID,
  compareWithCandidate,
  loadClosetItems,
  type PairingStats,
} from "./pairings";
import {
  ACCESSORY_NOTICE,
  EMPTY_CLOSET_REPEAT_REASON,
  fillsGapReason,
  gapReason,
  outfitsReason,
  revivesReason,
  suitsYouReason,
} from "./reasons";
import {
  countPoints,
  MAX_POINTS,
  POINTS_PER_OUTFIT,
  POINTS_PER_REVIVED,
  roundPart,
} from "./score";
import { itemPhotos, scoringPhoto } from "./score-photos";
import { categoryOf, toClosetItem, type ClosetItem } from "./types";

export type ScoreFn = (input: ScorePurchaseInput) => Promise<ScorePurchaseOutput>;
export type RepeatFn = (input: JudgeRepeatInput) => Promise<JudgeRepeatOutput>;

// Example outfits shown with the result.
export const SAMPLE_OUTFITS = 3;

export const NO_FIT_SUMMARY = "Tell us how your clothes feel to get a read on the fit.";

interface Part {
  points: number;
  max: number;
  reason: string;
}

export interface SampleOutfit {
  id: string;
  // The candidate has no stored image; the page shows its own copy.
  pieces: { id: string; title: string; imageUrl: string | null; isCandidate: boolean }[];
}

export interface BuyCheckResult {
  score: number;
  // The model's one-line take on the fit.
  summary: string;
  parts: {
    suitsYou: Part & { answers: FitAnswer[] };
    outfits: Part & { count: number };
    revives: Part & { items: { id: string; title: string }[] };
    fillsGap: Part & { tier: OccasionGapTier; occasions: OccasionChange[] };
    // The owned item it's most like, per the model, with its first photo.
    notRepeat: Part & { item: { id: string; title: string; imageUrl: string | null } | null };
  };
  // Set only when the candidate forms no outfit at all.
  // `slots` holds what's missing for each way to build an outfit around it.
  gap: { kind: GapKind; slots: MissingSlot[][]; reason: string } | null;
  sampleOutfits: SampleOutfit[];
  stats: PairingStats;
}

export type BuyCheck =
  | { result: BuyCheckResult }
  | { unsupported: Extract<Category, "accessory">; message: string };

// The scoring models still left something out after every retry: the check
// has no score, and the page offers to try again.
export function isIncomplete(err: unknown): boolean {
  return err instanceof AiOutputError && (err.fn === "scorePurchase" || err.fn === "judgeRepeat");
}

export interface Candidate {
  title: string;
  tags: ItemTags;
  // From the page, never stored; without it the model goes by the tags.
  photo?: Buffer | null;
}

interface Profile {
  summary: ProfileSummary;
  // Null when missing or not in the current format.
  mix: LifestyleMix | null;
}

const NO_MIX: LifestyleMix = { work: 0, school: 0, social: 0, sport: 0, home: 0 };

export async function loadProfile(db: Db, userId: string): Promise<Profile | null> {
  const { data } = await db
    .from("users")
    .select("body_shape, height_cm, lifestyle_mix")
    .eq("id", userId)
    .maybeSingle()
    .throwOnError();
  if (!data) return null;
  const parsed = LifestyleMix.safeParse(data.lifestyle_mix);
  const mix = parsed.success ? parsed.data : null;
  return {
    mix,
    summary: {
      ...(data.body_shape && { bodyShape: data.body_shape }),
      ...(data.height_cm && data.height_cm > 0 && { heightCm: Number(data.height_cm) }),
      lifestyleMix: mix ?? NO_MIX,
    },
  };
}

// The latest parsed feeling per item; unparsed or invalid ones are skipped.
async function loadFeelings(
  db: Db,
  userId: string,
  itemIds: ReadonlySet<string>,
): Promise<Map<string, FeelingStructured>> {
  const { data } = await db
    .from("item_feelings")
    .select("item_id, structured")
    .eq("user_id", userId)
    .not("structured", "is", null)
    .order("created_at", { ascending: false })
    .throwOnError();
  const feelings = new Map<string, FeelingStructured>();
  for (const row of data) {
    if (!itemIds.has(row.item_id) || feelings.has(row.item_id)) continue;
    const parsed = FeelingStructured.safeParse(row.structured);
    if (parsed.success) feelings.set(row.item_id, parsed.data);
  }
  return feelings;
}

async function askFit(
  score: ScoreFn,
  db: Db,
  userId: string,
  candidate: ClosetItem & { photo: Buffer | null },
  closet: readonly ClosetItem[],
  feelings: Map<string, FeelingStructured>,
  profile: ProfileSummary,
  styleProfile: StyleLine[] | null,
): Promise<{ answers: FitAnswer[]; summary: string }> {
  const rows = pickFeltItems(closet, feelings, candidate);
  const trouble = troubleAreas(rows.map((r) => r.feeling));
  const asked = FIT_QUESTIONS.filter((q) => hasBasis(q.basis, rows, trouble));
  if (asked.length === 0) return { answers: fitAnswers([], null), summary: NO_FIT_SUMMARY };
  // The candidate's photo and the closest felt items' photos.
  const [candidatePhoto, photos] = await Promise.all([
    candidate.photo && scoringPhoto(candidate.photo),
    itemPhotos(db, userId, rows.slice(0, MAX_FELT_PHOTOS).map((r) => r.item.id)),
  ]);
  const output = await score({
    candidate: { ...toItemSummary(candidate), ...(candidatePhoto && { photo: candidatePhoto }) },
    profile,
    feltItems: rows.map((row) => {
      const photo = photos.get(row.item.id);
      return { ...toFeltItem(row), ...(photo && { photo }) };
    }),
    troubleAreas: trouble,
    questions: asked.map(({ id, text }) => ({ id, text })),
    ...(styleProfile && { styleProfile }),
  });
  return { answers: fitAnswers(asked, output), summary: output.summary };
}

async function askRepeat(
  repeat: RepeatFn,
  candidate: ClosetItem,
  closet: readonly ClosetItem[],
): Promise<{ points: number; reason: string; item: { id: string; title: string } | null }> {
  if (closet.length === 0) return { points: MAX_POINTS.notRepeat, reason: EMPTY_CLOSET_REPEAT_REASON, item: null };
  const output = await repeat({ candidate: toItemSummary(candidate), closet: closet.map(toItemSummary) });
  const closest = closet.find((i) => i.id === output.closestId);
  return {
    points: output.score,
    reason: output.reason,
    item: closest ? { id: closest.id, title: closest.title } : null,
  };
}

// The first photo of each owned item the page shows, ready to load.
async function firstImages(db: Db, itemIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(itemIds)].filter((id) => id !== CANDIDATE_ITEM_ID);
  const images = new Map<string, string>();
  if (ids.length > 0) {
    const { data } = await db.from("items").select("id, image_paths").in("id", ids).throwOnError();
    await Promise.all(
      data.map(async (row) => {
        const [url] = await imageUrls(db, row.image_paths.slice(0, 1));
        if (url) images.set(row.id, url);
      }),
    );
  }
  return images;
}

function sampleOutfits(
  itemIdLists: string[][],
  titles: ReadonlyMap<string, string>,
  images: ReadonlyMap<string, string>,
): SampleOutfit[] {
  return itemIdLists.map((itemIds) => ({
    id: itemIds.join("+"),
    pieces: itemIds.map((id) => ({
      id,
      title: titles.get(id) ?? "",
      imageUrl: images.get(id) ?? null,
      isCandidate: id === CANDIDATE_ITEM_ID,
    })),
  }));
}

function gapNotice(slots: MissingSlot[][], category: Category): NonNullable<BuyCheckResult["gap"]> {
  const kind = gapKind(slots);
  return { kind, slots, reason: gapReason(slots, kind, category) };
}

// Null when the user doesn't exist.
export async function runBuyCheck(
  db: Db,
  userId: string,
  input: Candidate,
  ai: { judge: JudgeFn; score: ScoreFn; repeat: RepeatFn },
): Promise<BuyCheck | null> {
  const candidate = toClosetItem(CANDIDATE_ITEM_ID, input.title, input.tags);
  if (!candidate) throw new Error("Invalid candidate tags");
  if (categoryOf(candidate) === "accessory") {
    return { unsupported: "accessory", message: ACCESSORY_NOTICE };
  }

  const [profile, { items: closet, skippedItemIds }] = await Promise.all([
    loadProfile(db, userId),
    loadClosetItems(db, userId),
  ]);
  if (!profile) return null;
  const closetIds = closet.map((i) => i.id);
  // The style card helps the fit questions, stale or not; without one the
  // model gets the same request as before cards existed.
  const [feelings, styleProfile] = await Promise.all([
    loadFeelings(db, userId, new Set(closetIds)),
    loadStyleCardForScoring(db, userId, new Set([...closetIds, ...skippedItemIds])),
  ]);

  // The model never sees the gap numbers, so all the calls can run at once.
  const [comparison, fit, repeat] = await Promise.all([
    compareWithCandidate(db, userId, closet, ai.judge, candidate),
    askFit(ai.score, db, userId, { ...candidate, photo: input.photo ?? null }, closet, feelings, profile.summary, styleProfile),
    askRepeat(ai.repeat, candidate, closet),
  ]);
  const { before, after } = comparison;

  const titles = new Map([...closet, comparison.candidate].map((i) => [i.id, i.title]));
  const outfitCount = after.summary.byItem[CANDIDATE_ITEM_ID] ?? 0;
  const revived = revivedItemIds(before.summary.byItem, after.summary.byItem).map((id) => ({
    id,
    title: titles.get(id) ?? "",
  }));
  const gapByOccasion = occasionGap(profile.mix, before.summary.byOccasion, after.summary.byOccasion);
  const withCandidate = after.outfits
    .filter((o) => o.itemIds.includes(CANDIDATE_ITEM_ID))
    .slice(0, SAMPLE_OUTFITS)
    .map((o) => o.itemIds);
  const images = await firstImages(db, [...withCandidate.flat(), ...(repeat.item ? [repeat.item.id] : [])]);

  const parts: BuyCheckResult["parts"] = {
    suitsYou: {
      points: fit.answers.reduce((sum, a) => sum + a.points, 0),
      max: MAX_POINTS.suitsYou,
      reason: suitsYouReason(fit.answers),
      answers: fit.answers,
    },
    outfits: {
      points: roundPart(countPoints(outfitCount, POINTS_PER_OUTFIT, MAX_POINTS.outfits)),
      max: MAX_POINTS.outfits,
      reason: outfitsReason(outfitCount),
      count: outfitCount,
    },
    revives: {
      points: roundPart(countPoints(revived.length, POINTS_PER_REVIVED, MAX_POINTS.revives)),
      max: MAX_POINTS.revives,
      reason: revivesReason(revived.map((r) => r.title)),
      items: revived,
    },
    fillsGap: {
      ...gapByOccasion,
      points: roundPart(gapByOccasion.points),
      max: MAX_POINTS.fillsGap,
      reason: fillsGapReason(gapByOccasion.tier, gapByOccasion.occasions, profile.mix !== null),
    },
    notRepeat: {
      ...repeat,
      max: MAX_POINTS.notRepeat,
      item: repeat.item && { ...repeat.item, imageUrl: images.get(repeat.item.id) ?? null },
    },
  };

  const slots = outfitCount === 0 ? missingSlots(candidate, closet, comparison.mightPair) : null;

  return {
    result: {
      score: roundPart(Object.values(parts).reduce((sum, p) => sum + p.points, 0)),
      summary: fit.summary,
      parts,
      gap: slots && gapNotice(slots, categoryOf(candidate)),
      sampleOutfits: sampleOutfits(withCandidate, titles, images),
      stats: comparison.stats,
    },
  };
}
