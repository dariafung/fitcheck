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

export type SellerMatches =
  | { state: "unchecked" }
  | { state: "none_strong" }
  | { state: "matches"; matches: AnonMatch[] };

// Scores at or over the threshold, best first. Ties keep a fixed order.
export function strongMatches(itemId: string, rows: { buyer_id: string; score: number }[]): SellerMatches {
  if (rows.length === 0) return { state: "unchecked" };
  const matches = rows
    .filter((r) => r.score >= RESALE_SCORE_THRESHOLD)
    .map((r) => ({ ...anonBuyer(itemId, r.buyer_id), score: Number(r.score) }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  return matches.length > 0 ? { state: "matches", matches } : { state: "none_strong" };
}

// The cached checks for buyers still in the pool; someone who opted out or no
// longer fits the size drops out even if their check is cached.
export async function sellerMatches(db: Db, itemId: string, buyerIds: string[]): Promise<SellerMatches> {
  const { data } = await db
    .from("resale_matches")
    .select("buyer_id, score")
    .eq("item_id", itemId)
    .in("buyer_id", buyerIds)
    .throwOnError();
  return strongMatches(itemId, data);
}
