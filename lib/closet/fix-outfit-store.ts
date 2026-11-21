// An outfit for an owned piece its owner is unhappy with (rated 1 or 2 stars,
// or with a complaint in its feeling): one suggestion per item, kept in
// item_fix_outfits and asked for again only when the low rating, the
// complaints, the closet items to choose from or the prompt change. The model
// function is passed in by the Route Handler.
import { AiError } from "@/lib/ai/errors";
import { PROMPT_VERSION, type PickFixOutfitInput, type PickFixOutfitOutput } from "@/lib/ai/schemas/pick-fix-outfit";
import { loadClosetItems } from "@/lib/check/pairings";
import { itemPhotos } from "@/lib/check/score-photos";
import { DEMO_USER_ID } from "@/lib/db/demo-user";
import type { Db } from "@/lib/db/server";
import { canComplete, fixCloset, fixHash, fixInput, isLowRating, negativeAspects, outfitKey, pickedOutfit } from "./fix-outfit";
import { isItemId } from "./items";
import { outfitPieces, outfitView, type OutfitView } from "./outfit-pieces";
import { findSavedOutfit } from "./saved-outfits";

export type PickFn = (input: PickFixOutfitInput) => Promise<PickFixOutfitOutput>;

export type FixState =
  // Nothing to show: not active, neither rated low nor complained about, or
  // the model couldn't be asked and nothing usable is stored.
  | { state: "none" }
  // The feeling is still being parsed.
  | { state: "pending" }
  // The closet can't complete an outfit, or the model said nothing helps.
  | { state: "no_fix" }
  | { state: "suggestion"; itemIds: string[]; reason: string };

// What the item page gets.
export type FixView =
  | { state: "none" | "pending" | "no_fix" }
  | { state: "suggestion"; outfit: OutfitView; reason: string; savedId: string | null };

const NONE: FixState = { state: "none" };
const NO_FIX: FixState = { state: "no_fix" };
const PENDING: FixState = { state: "pending" };

// Postgres: the row points at an item that is gone.
const FOREIGN_KEY_VIOLATION = "23503";

async function latestFeeling(db: Db, userId: string, itemId: string) {
  const { data } = await db
    .from("item_feelings")
    .select("structured, parsed_at")
    .eq("item_id", itemId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .throwOnError();
  return data;
}

// Whether the item page should ask for a suggestion at all. "wait": the
// feeling is still being parsed, so what it complains about isn't known yet.
// "ask": the item is rated low, or its parsed feeling has a complaint.
// "off": neither.
export async function fixTrigger(
  db: Db,
  userId: string,
  itemId: string,
  rating: number | null,
): Promise<"off" | "ask" | "wait"> {
  const feeling = await latestFeeling(db, userId, itemId);
  if (feeling && !feeling.parsed_at) return "wait";
  if (isLowRating(rating)) return "ask";
  return feeling && negativeAspects(feeling.structured).length > 0 ? "ask" : "off";
}

interface StoredFix {
  inputHash: string;
  itemIds: string[] | null;
  reason: string | null;
}

async function loadStored(db: Db, itemId: string): Promise<StoredFix | null> {
  const { data } = await db
    .from("item_fix_outfits")
    .select("input_hash, outfit_item_ids, reason")
    .eq("item_id", itemId)
    .maybeSingle()
    .throwOnError();
  return data && { inputHash: data.input_hash, itemIds: data.outfit_item_ids, reason: data.reason };
}

async function store(db: Db, userId: string, itemId: string, hash: string, picked: { itemIds: string[]; reason: string } | null) {
  const { error } = await db.from("item_fix_outfits").upsert(
    {
      item_id: itemId,
      user_id: userId,
      input_hash: hash,
      prompt_version: PROMPT_VERSION,
      outfit_item_ids: picked && outfitKey(picked.itemIds),
      reason: picked && picked.reason,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "item_id" },
  );
  // The item was deleted meanwhile: nothing to keep.
  if (error && error.code !== FOREIGN_KEY_VIOLATION) throw error;
}

// The suggestion for one of the user's items, or null when it is not theirs.
// Asks the model only when nothing is stored for the item as it is now (low
// rating, complaints, the closet items to choose from); when the model can't
// be asked (it failed, the day's budget or count is used up) the stored
// suggestion stays, and with none stored there is nothing to show. The persona's suggestions come from the seed and are
// never asked for, even with sign-in off.
//
// While the feeling is still being parsed the answer is "pending", so the
// page asks again. `settle` is the page's last try: a piece rated low is then
// suggested for from the rating alone, as if nothing were written (when the
// feeling does parse with a complaint, the hash changes and it is asked for
// again). A piece that isn't rated low stays pending.
export async function fixOutfitFor(
  db: Db,
  userId: string,
  itemId: string,
  pick: PickFn,
  { settle = false }: { settle?: boolean } = {},
): Promise<FixState | null> {
  if (!isItemId(itemId)) return null;
  const { data: item } = await db
    .from("items")
    .select("id, status, rating")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle()
    .throwOnError();
  if (!item) return null;
  if (item.status !== "active") return NONE;

  const feeling = await latestFeeling(db, userId, itemId);
  const unparsed = feeling !== null && !feeling.parsed_at;
  const lowRating = isLowRating(item.rating);
  if (unparsed && !lowRating) return PENDING;
  // What an unparsed note complains about isn't known: the rating alone counts.
  const complaints = unparsed ? [] : negativeAspects(feeling?.structured);
  if (!lowRating && complaints.length === 0) return NONE;

  const [stored, closet] = await Promise.all([loadStored(db, itemId), loadClosetItems(db, userId)]);
  const activeIds = new Set([...closet.items.map((i) => i.id), ...closet.skippedItemIds]);
  // A stored outfit shows only while every piece is still in the closet.
  const kept = (): FixState => {
    if (!stored?.itemIds || !stored.reason) return NONE;
    const whole = stored.itemIds.includes(itemId) && stored.itemIds.every((id) => activeIds.has(id));
    return whole ? { state: "suggestion", itemIds: stored.itemIds, reason: stored.reason } : NONE;
  };
  if (userId === DEMO_USER_ID) return stored && !stored.itemIds ? NO_FIX : kept();

  const self = closet.items.find((i) => i.id === itemId);
  // Free checks first: with nothing that completes an outfit (no shoes,
  // say), the model isn't asked.
  const list = self ? fixCloset(self, closet.items) : [];
  if (!self || !canComplete(self, list)) return NO_FIX;

  const input = fixInput(self, complaints, lowRating, list);
  const hash = fixHash(input);
  if (stored?.inputHash === hash) return stored.itemIds ? kept() : NO_FIX;

  // Not stored yet for the rating alone: wait for the note until the last try.
  if (unparsed && !settle) return PENDING;

  // The item's own photo, shrunk; without one it goes as text.
  const photo = (await itemPhotos(db, userId, [itemId])).get(itemId);
  let output: PickFixOutfitOutput;
  try {
    output = await pick({ ...input, item: { ...input.item, ...(photo && { photo }) } });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    console.error(`pickFixOutfit skipped for item ${itemId}: ${err.name}`);
    return kept();
  }
  const picked = pickedOutfit(output, self, list);
  await store(db, userId, itemId, hash, picked);
  return picked ? { state: "suggestion", itemIds: picked.itemIds, reason: picked.reason } : NO_FIX;
}

// Adds what the page draws: the pieces, and whether the outfit is saved.
export async function fixView(db: Db, userId: string, fix: FixState): Promise<FixView> {
  if (fix.state !== "suggestion") return fix;
  const [pieces, saved] = await Promise.all([
    outfitPieces(db, userId, fix.itemIds),
    findSavedOutfit(db, userId, fix.itemIds),
  ]);
  const outfit = outfitView(fix.itemIds, pieces);
  // A piece left the closet since the outfit was read.
  if (!outfit) return { state: "none" };
  return { state: "suggestion", outfit, reason: fix.reason, savedId: saved?.id ?? null };
}
