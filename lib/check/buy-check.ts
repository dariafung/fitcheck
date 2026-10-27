// "Should I buy this?" for one candidate: compare the closet's outfits with
// and without it, ask the model the fit questions, score it all in code.
// The candidate is never stored: not in items, not in pairings, not cached.
import {
  FeelingStructured,
  LifestyleMix,
  type Category,
  type ItemTags,
  type ProfileSummary,
} from "../ai/schemas/common";
import type { ScorePurchaseInput, ScorePurchaseOutput } from "../ai/schemas/score-purchase";
import { imageUrls } from "../closet/images";
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
  findDuplicate,
  missingSlots,
  occasionGap,
  revivedItemIds,
  type DuplicateTier,
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
  fillsGapReason,
  gapReason,
  notRepeatReason,
  outfitsReason,
  revivesReason,
  suitsYouReason,
} from "./reasons";
import {
  DUPLICATE_POINTS,
  MAX_POINTS,
  OCCASION_GAP_POINTS,
  OUTFIT_TIERS,
  REVIVE_TIERS,
  tierPoints,
} from "./score";
import { categoryOf, toClosetItem, type ClosetItem } from "./types";

export type ScoreFn = (input: ScorePurchaseInput) => Promise<ScorePurchaseOutput>;

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
    notRepeat: Part & { tier: DuplicateTier; item: { id: string; title: string } | null };
  };
  // Set only when the candidate forms no outfit at all.
  gap: { slots: MissingSlot[]; reason: string } | null;
  sampleOutfits: SampleOutfit[];
  stats: PairingStats;
}

export type BuyCheck =
  | { result: BuyCheckResult }
  | { unsupported: Extract<Category, "accessory">; message: string };

export interface Candidate {
  title: string;
  tags: ItemTags;
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
  candidate: ClosetItem,
  closet: readonly ClosetItem[],
  feelings: Map<string, FeelingStructured>,
  profile: ProfileSummary,
): Promise<{ answers: FitAnswer[]; summary: string }> {
  const rows = pickFeltItems(closet, feelings, candidate);
  const trouble = troubleAreas(rows.map((r) => r.feeling));
  const asked = FIT_QUESTIONS.filter((q) => hasBasis(q.basis, rows, trouble));
  if (asked.length === 0) return { answers: fitAnswers([], null), summary: NO_FIT_SUMMARY };
  const output = await score({
    candidate: toItemSummary(candidate),
    profile,
    feltItems: rows.map(toFeltItem),
    troubleAreas: trouble,
    questions: asked.map(({ id, text }) => ({ id, text })),
  });
  return { answers: fitAnswers(asked, output), summary: output.summary };
}

async function sampleOutfits(
  db: Db,
  itemIdLists: string[][],
  titles: ReadonlyMap<string, string>,
): Promise<SampleOutfit[]> {
  const ids = [...new Set(itemIdLists.flat())].filter((id) => id !== CANDIDATE_ITEM_ID);
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

// Null when the user doesn't exist.
export async function runBuyCheck(
  db: Db,
  userId: string,
  input: Candidate,
  ai: { judge: JudgeFn; score: ScoreFn },
): Promise<BuyCheck | null> {
  const candidate = toClosetItem(CANDIDATE_ITEM_ID, input.title, input.tags);
  if (!candidate) throw new Error("Invalid candidate tags");
  if (categoryOf(candidate) === "accessory") {
    return { unsupported: "accessory", message: ACCESSORY_NOTICE };
  }

  const [profile, { items: closet }] = await Promise.all([
    loadProfile(db, userId),
    loadClosetItems(db, userId),
  ]);
  if (!profile) return null;
  const feelings = await loadFeelings(db, userId, new Set(closet.map((i) => i.id)));

  // The model never sees the gap numbers, so both calls can run at once.
  const [comparison, fit] = await Promise.all([
    compareWithCandidate(db, userId, closet, ai.judge, candidate),
    askFit(ai.score, candidate, closet, feelings, profile.summary),
  ]);
  const { before, after } = comparison;

  const titles = new Map([...closet, comparison.candidate].map((i) => [i.id, i.title]));
  const outfitCount = after.summary.byItem[CANDIDATE_ITEM_ID] ?? 0;
  const revived = revivedItemIds(before.summary.byItem, after.summary.byItem).map((id) => ({
    id,
    title: titles.get(id) ?? "",
  }));
  const gapByOccasion = occasionGap(profile.mix, before.summary.byOccasion, after.summary.byOccasion);
  const duplicate = findDuplicate(candidate, closet);
  const duplicateOf = duplicate.item && { id: duplicate.item.id, title: duplicate.item.title };

  const parts: BuyCheckResult["parts"] = {
    suitsYou: {
      points: fit.answers.reduce((sum, a) => sum + a.points, 0),
      max: MAX_POINTS.suitsYou,
      reason: suitsYouReason(fit.answers),
      answers: fit.answers,
    },
    outfits: {
      points: tierPoints(outfitCount, OUTFIT_TIERS),
      max: MAX_POINTS.outfits,
      reason: outfitsReason(outfitCount),
      count: outfitCount,
    },
    revives: {
      points: tierPoints(revived.length, REVIVE_TIERS),
      max: MAX_POINTS.revives,
      reason: revivesReason(revived.map((r) => r.title)),
      items: revived,
    },
    fillsGap: {
      points: OCCASION_GAP_POINTS[gapByOccasion.tier],
      max: MAX_POINTS.fillsGap,
      reason: fillsGapReason(gapByOccasion.tier, gapByOccasion.occasions, profile.mix !== null),
      ...gapByOccasion,
    },
    notRepeat: {
      points: DUPLICATE_POINTS[duplicate.tier],
      max: MAX_POINTS.notRepeat,
      reason: notRepeatReason(duplicate.tier, duplicateOf?.title ?? null),
      tier: duplicate.tier,
      item: duplicateOf,
    },
  };

  const slots = outfitCount === 0 ? missingSlots(candidate, closet, comparison.mightPair) : null;
  const withCandidate = after.outfits
    .filter((o) => o.itemIds.includes(CANDIDATE_ITEM_ID))
    .slice(0, SAMPLE_OUTFITS)
    .map((o) => o.itemIds);

  return {
    result: {
      score: Object.values(parts).reduce((sum, p) => sum + p.points, 0),
      summary: fit.summary,
      parts,
      gap: slots && { slots, reason: gapReason(slots) },
      sampleOutfits: await sampleOutfits(db, withCandidate, titles),
      stats: comparison.stats,
    },
  };
}
