// What the seller of a passing-on item sees about its buyers: an anonymous
// circle and a score for everyone whose cached buy check scored high enough.
// Never who they are, and never the reasons (those are the buyer's).
import type { Db } from "@/lib/db/server";
import { anonBuyer } from "./avatar";

export const RESALE_SCORE_THRESHOLD = 60;

export interface AnonMatch {
  key: string;
  color: string;
  score: number;
}

// someUnchecked: buyers in the pool still waiting for a check that's up to date.
export type SellerMatches =
  | { state: "unchecked" }
  | { state: "none_strong"; someUnchecked: boolean }
  | { state: "matches"; matches: AnonMatch[]; someUnchecked: boolean };

// Scores at or over the threshold, best first. Ties keep a fixed order.
export function strongMatches(
  itemId: string,
  rows: { buyer_id: string; score: number }[],
  someUnchecked = false,
): SellerMatches {
  if (rows.length === 0) return { state: "unchecked" };
  const matches = rows
    .filter((r) => r.score >= RESALE_SCORE_THRESHOLD)
    .map((r) => ({ ...anonBuyer(itemId, r.buyer_id), score: Number(r.score) }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  return matches.length > 0
    ? { state: "matches", matches, someUnchecked }
    : { state: "none_strong", someUnchecked };
}

// The cached checks for buyers still in the pool whose fingerprint still
// holds; someone who opted out or no longer fits the size drops out even if
// their check is cached. `fingerprints` maps each buyer in the pool to theirs.
export async function sellerMatches(
  db: Db,
  itemId: string,
  fingerprints: ReadonlyMap<string, string>,
): Promise<SellerMatches> {
  const { data } = await db
    .from("resale_matches")
    .select("buyer_id, score, fingerprint")
    .eq("item_id", itemId)
    .in("buyer_id", [...fingerprints.keys()])
    .throwOnError();
  const fresh = data.filter((r) => fingerprints.get(r.buyer_id) === r.fingerprint);
  return strongMatches(itemId, fresh, fresh.length < fingerprints.size);
}

// The buyers in the pool without an up-to-date cached check.
export async function staleBuyerIds(
  db: Db,
  itemId: string,
  fingerprints: ReadonlyMap<string, string>,
): Promise<Set<string>> {
  const { data } = await db
    .from("resale_matches")
    .select("buyer_id, fingerprint")
    .eq("item_id", itemId)
    .in("buyer_id", [...fingerprints.keys()])
    .throwOnError();
  const fresh = new Set(data.filter((r) => fingerprints.get(r.buyer_id) === r.fingerprint).map((r) => r.buyer_id));
  return new Set([...fingerprints.keys()].filter((id) => !fresh.has(id)));
}
