import { z } from "zod";
import { FeelingStructured, ItemSummary, Occasion } from "./common";

export const PROMPT_VERSION = "summarize-wear@2";

export const MAX_INSIGHTS = 3;
export const INSIGHT_MAX_WORDS = 30;

// What an insight is about. say_vs_wear: how the owner talks about a piece
// next to how often they wear it, clashing or matching; occasion: outfits wanted for an occasion
// against what they wore to it.
export const InsightKind = z.enum(["say_vs_wear", "idle", "favorite", "occasion", "pattern"]);
export type InsightKind = z.infer<typeof InsightKind>;

// One active item over the window. Counts are outfits, not days. No dates,
// only counts and days back from the window's last day, so the same log
// always hashes the same.
const WornItem = ItemSummary.extend({
  wornCount: z.int().min(0),
  // Null when it wasn't worn in the window.
  lastWornDaysAgo: z.int().min(0).nullable(),
  // Days since it was added, when that's under a week (NEW_ITEM_DAYS); null
  // when it was there long enough to count as owned all along.
  addedDaysAgo: z.int().min(0).nullable(),
  feeling: FeelingStructured.pick({ flattering: true, liked: true, aspects: true }).nullable(),
});

const OccasionLog = z.object({
  occasion: Occasion,
  // Different outfits wanted per season.
  wanted: z.int().min(0),
  outfitsLogged: z.int().min(0),
  distinctOutfits: z.int().min(0),
});

export const SummarizeWearInput = z.object({
  windowDays: z.int().min(1),
  loggedDays: z.int().min(1),
  outfitCount: z.int().min(1),
  items: z.array(WornItem).min(1),
  occasions: z.array(OccasionLog),
});
export type SummarizeWearInput = z.input<typeof SummarizeWearInput>;

// Every insight names the items it's about; only an occasion insight may
// have none (nothing worn to it yet).
export const WearInsight = z
  .object({
    kind: InsightKind,
    text: z.string().min(1),
    itemIds: z.array(z.uuid()),
  })
  .refine((i) => i.kind === "occasion" || i.itemIds.length > 0, { message: "Name at least one item" });
export type WearInsight = z.infer<typeof WearInsight>;

export const SummarizeWearOutput = z.object({
  insights: z.array(WearInsight).min(1).max(MAX_INSIGHTS),
});
export type SummarizeWearOutput = z.output<typeof SummarizeWearOutput>;
