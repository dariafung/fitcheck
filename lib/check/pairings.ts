// Closet → outfits: load items, apply the rule filter, reuse cached model
// verdicts from the pairings table, ask the model about the rest, enumerate.
import type { ItemTags } from "../ai/schemas/common";
import { PROMPT_VERSION } from "../ai/schemas/judge-pairing";
import { effectiveTags } from "../db/items";
import type { Db } from "../db/server";
import {
  isFresh,
  judgeInBatches,
  type CachedPairing,
  type JudgeFn,
  type PairVerdict,
} from "./judge";
import { enumerateOutfits, pairsInOutfits, type OutfitSet } from "./outfits";
import { checkRules, isComplementary } from "./rules";
import {
  categoryOf,
  pairKey,
  toClosetItem,
  type ClosetItem,
  type Compatible,
} from "./types";

// Statuses that count as owned.
export const OWNED_STATUSES = ["active"] as const;

// A candidate being checked is never stored, so it gets this fixed stand-in
// id: stable across runs (same order, same replay hash), never in the table.
export const CANDIDATE_ITEM_ID = "00000000-0000-4000-8000-000000000000";

// Build one from extracted tags with toClosetItem(CANDIDATE_ITEM_ID, title, tags).
export type CandidateItem = Omit<ClosetItem, "id" | "updatedAt">;

// Supabase returns at most 1000 rows per request.
const PAGE_SIZE = 1000;

const ITEM_COLUMNS = "id, title, ai_tags, user_tags, updated_at";

export interface LoadedCloset {
  items: ClosetItem[];
  // Items whose tags are missing or invalid (e.g. extraction not done yet).
  skippedItemIds: string[];
}

export async function loadClosetItems(db: Db, userId: string): Promise<LoadedCloset> {
  const { data: rows } = await db
    .from("items")
    .select(ITEM_COLUMNS)
    .eq("user_id", userId)
    .in("status", [...OWNED_STATUSES])
    .order("id")
    .throwOnError();
  const items: ClosetItem[] = [];
  const skippedItemIds: string[] = [];
  for (const row of rows) {
    const item = row.ai_tags
      ? toClosetItem(
          row.id,
          row.title,
          effectiveTags(row.ai_tags as ItemTags, row.user_tags as Partial<ItemTags>),
          row.updated_at,
        )
      : null;
    if (item) items.push(item);
    else skippedItemIds.push(row.id);
  }
  return { items, skippedItemIds };
}

async function loadCachedPairings(db: Db, userId: string): Promise<CachedPairing[]> {
  const rows: CachedPairing[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await db
      .from("pairings")
      .select("item_a_id, item_b_id, pairs, reason, source, prompt_version, created_at")
      .eq("user_id", userId)
      .order("id")
      .range(from, from + PAGE_SIZE - 1)
      .throwOnError();
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// pairings.created_at holds the version of the tags that was judged: the later
// updated_at of the two items as read, not the time of judging. Both sides of
// the freshness check then come from the database clock, so app and database
// clocks drifting apart can't make a verdict look stale or fresh by mistake.
function judgedVersion(a: ClosetItem | undefined, b: ClosetItem | undefined): string {
  const stamps = [a?.updatedAt, b?.updatedAt].filter((s): s is string => Boolean(s));
  if (stamps.length === 0) return new Date().toISOString();
  return stamps.reduce((x, y) => (Date.parse(y) > Date.parse(x) ? y : x));
}

async function saveVerdicts(
  db: Db,
  userId: string,
  verdicts: PairVerdict[],
  byId: ReadonlyMap<string, ClosetItem>,
) {
  await db
    .from("pairings")
    .upsert(
      verdicts.map((v) => ({
        user_id: userId,
        item_a_id: v.aId,
        item_b_id: v.bId,
        pairs: v.pairs,
        reason: v.reason,
        source: "ai",
        prompt_version: PROMPT_VERSION,
        created_at: judgedVersion(byId.get(v.aId), byId.get(v.bId)),
      })),
      { onConflict: "item_a_id,item_b_id" },
    )
    .throwOnError();
}

export interface PairingStats {
  // Pairs whose categories can share an outfit.
  rulePairs: number;
  // Of those, dropped by formality, temperature or color.
  ruleRejected: number;
  // Pairs that appear in some outfit the rules allow; only these need a verdict.
  neededPairs: number;
  cached: number;
  judged: number;
  judgeCalls: number;
  // Pairs the model didn't answer; treated as not pairing this time.
  missing: number;
}

export interface Compatibility {
  compatible: Compatible;
  stats: PairingStats;
}

// Pairs touching `uncachedIds` skip the cache both ways: always asked, never saved.
export async function resolveCompatibility(
  db: Db,
  userId: string,
  items: readonly ClosetItem[],
  judge: JudgeFn,
  uncachedIds: ReadonlySet<string> = new Set(),
): Promise<Compatibility> {
  const rulePass = new Map<string, boolean>();
  let ruleRejected = 0;
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const [a, b] = [items[i], items[j]];
      if (!isComplementary(categoryOf(a), categoryOf(b))) continue;
      const pass = checkRules(a, b).pass;
      rulePass.set(pairKey(a.id, b.id), pass);
      if (!pass) ruleRejected += 1;
    }
  }
  const passesRules: Compatible = (a, b) => rulePass.get(pairKey(a.id, b.id)) === true;
  const needed = pairsInOutfits(items, passesRules);

  const byId = new Map(items.map((item) => [item.id, item]));
  const verdicts = new Map<string, boolean>();
  const cacheable = (aId: string, bId: string) =>
    !uncachedIds.has(aId) && !uncachedIds.has(bId);
  for (const row of await loadCachedPairings(db, userId)) {
    const key = pairKey(row.item_a_id, row.item_b_id);
    if (needed.has(key) && cacheable(row.item_a_id, row.item_b_id) && isFresh(row, byId)) {
      verdicts.set(key, row.pairs);
    }
  }
  const cached = verdicts.size;

  const toJudge = [...needed].filter(([key]) => !verdicts.has(key)).map(([, pair]) => pair);
  const judged = await judgeInBatches(toJudge, judge, async (batch) => {
    const keep = batch.filter((v) => cacheable(v.aId, v.bId));
    if (keep.length > 0) await saveVerdicts(db, userId, keep, byId);
  });
  for (const [key, verdict] of judged.verdicts) verdicts.set(key, verdict.pairs);

  return {
    compatible: (a, b) => passesRules(a, b) && verdicts.get(pairKey(a.id, b.id)) === true,
    stats: {
      rulePairs: rulePass.size,
      ruleRejected,
      neededPairs: needed.size,
      cached,
      judged: judged.verdicts.size,
      judgeCalls: judged.calls,
      missing: judged.missing,
    },
  };
}

export interface ClosetOutfits extends OutfitSet {
  stats: PairingStats;
  skippedItemIds: string[];
}

// The closet's outfits; with a candidate, the closet plus that one item under
// CANDIDATE_ITEM_ID. Run both ways to compare before and after: the closet's
// own pairs come from the cache, the candidate's are asked every time.
export async function computeClosetOutfits(
  db: Db,
  userId: string,
  judge: JudgeFn,
  candidate?: CandidateItem,
): Promise<ClosetOutfits> {
  const { items, skippedItemIds } = await loadClosetItems(db, userId);
  const all = candidate ? [...items, { ...candidate, id: CANDIDATE_ITEM_ID }] : items;
  const uncached = new Set(candidate ? [CANDIDATE_ITEM_ID] : []);
  const { compatible, stats } = await resolveCompatibility(db, userId, all, judge, uncached);
  return { ...enumerateOutfits(all, compatible), stats, skippedItemIds };
}
