// Runs "Should I buy this?" from each buyer's side for a passing-on item:
// their closet, feelings and style card, with the seller's item as the
// candidate. Scores are cached per item and buyer (resale_matches) under a
// fingerprint, so only new buyers and buyers whose closet changed are checked.
import { LifestyleMix, type Occasion } from "@/lib/ai/schemas/common";
import { readPhoto } from "@/lib/check/board-pieces";
import { runBuyCheck, type BuyCheckResult } from "@/lib/check/buy-check";
import type { Db } from "@/lib/db/server";
import { type BuyerState, type SellerItem } from "./fingerprint";
import { staleBuyerIds } from "./matches";
import { buyerReasons } from "./reason-filter";

// New checks per opening of the item; the rest wait for the next one.
export const MAX_NEW_CHECKS = 5;

// Most parts named as a match's highlights.
const MAX_HIGHLIGHTS = 2;

export type BuyCheckAi = Parameters<typeof runBuyCheck>[3];

export interface BuyerToCheck {
  state: BuyerState;
  fingerprint: string;
}

type PartName = keyof BuyCheckResult["parts"];

// The parts that scored best for their size, best first; none that scored 0.
export function highlights(parts: BuyCheckResult["parts"]): PartName[] {
  return (Object.entries(parts) as [PartName, { points: number; max: number }][])
    .filter(([, p]) => p.points > 0)
    .sort(([, a], [, b]) => b.points / b.max - a.points / a.max)
    .slice(0, MAX_HIGHLIGHTS)
    .map(([name]) => name);
}

// The buyer's summary plus the reasons for their best code-scored parts.
function reasonsFor(result: BuyCheckResult): string[] {
  const { outfits, revives, fillsGap } = result.parts;
  const best = [outfits, revives, fillsGap]
    .filter((p) => p.points > 0)
    .sort((a, b) => b.points / b.max - a.points / a.max)
    .map((p) => p.reason);
  return buyerReasons(result.summary, best);
}

// Buyers who want the most outfits for the item's occasions first, then
// whoever joined first.
export function checkOrder(buyers: readonly BuyerState[], occasions: readonly Occasion[]): BuyerState[] {
  const wants = (b: BuyerState) => {
    const mix = LifestyleMix.safeParse(b.lifestyleMix);
    return mix.success ? Math.max(0, ...occasions.map((o) => mix.data[o])) : 0;
  };
  return [...buyers].sort(
    (a, b) => wants(b) - wants(a) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

// One run per item at a time in this server: a second request for the same
// item waits for the first instead of paying for the same checks again.
const running = new Map<string, Promise<void>>();

export interface CheckTarget {
  sellerId: string;
  itemId: string;
  item: SellerItem;
}

// Checks up to MAX_NEW_CHECKS of the buyers in the pool whose cached check
// is missing or out of date, all at once, in checkOrder. A buyer whose check
// fails (over budget, model never finished, …) is left unchecked; the others
// are saved either way.
export function checkBuyers(db: Db, target: CheckTarget, buyers: readonly BuyerToCheck[], ai: BuyCheckAi) {
  const pending = running.get(target.itemId);
  if (pending) return pending;
  const run = runChecks(db, target, buyers, ai).finally(() => {
    running.delete(target.itemId);
  });
  running.set(target.itemId, run);
  return run;
}

async function runChecks(db: Db, { sellerId, itemId, item }: CheckTarget, buyers: readonly BuyerToCheck[], ai: BuyCheckAi) {
  // Read inside the run, so a request that waited never repeats its checks.
  const fingerprints = new Map(buyers.map((b) => [b.state.id, b.fingerprint]));
  const stale = await staleBuyerIds(db, itemId, fingerprints);
  const toCheck = checkOrder(
    buyers.filter((b) => stale.has(b.state.id)).map((b) => b.state),
    item.tags.occasions,
  ).slice(0, MAX_NEW_CHECKS);
  if (toCheck.length === 0) return;
  const photo = item.photoPath ? await readPhoto(db, item.photoPath) : null;
  await Promise.all(
    toCheck.map(async (state) => {
      const fingerprint = fingerprints.get(state.id)!;
      try {
        const check = await runBuyCheck(db, state.id, { title: item.title, tags: item.tags, photo }, ai);
        if (!check || !("result" in check)) return;
        const { result } = check;
        await db
          .from("resale_matches")
          .upsert(
            {
              item_id: itemId,
              buyer_id: state.id,
              seller_id: sellerId,
              fingerprint,
              score: result.score,
              highlights: highlights(result.parts),
              buyer_reasons: reasonsFor(result),
              checked_at: new Date().toISOString(),
            },
            { onConflict: "item_id,buyer_id" },
          )
          .throwOnError();
      } catch {
        // Left unchecked; the next opening tries again.
      }
    }),
  );
}
