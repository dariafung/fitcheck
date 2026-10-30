// "Who'd want it" for one of the user's passing-on items.
import { Category } from "@/lib/ai/schemas/common";
import type { Db } from "@/lib/db/server";
import { isItemId } from "@/lib/closet/items";
import { sellerMatches, type AnonMatch } from "./matches";
import { buyerPool } from "./pool";

export type BuyersResult =
  | { state: "no_buyers" }
  | { state: "no_size_match" }
  | { state: "none_strong" }
  | { state: "matches"; matches: AnonMatch[] };

// Null when the item isn't the user's; "not_passing_on" when it isn't on its
// way out (or is an accessory, which isn't matched).
export async function findBuyers(
  db: Db,
  userId: string,
  itemId: string,
): Promise<BuyersResult | "not_passing_on" | null> {
  if (!isItemId(itemId)) return null;
  const [{ data: item }, { data: seller }] = await Promise.all([
    db
      .from("items")
      .select("category, status, size")
      .eq("id", itemId)
      .eq("user_id", userId)
      .maybeSingle()
      .throwOnError(),
    db.from("users").select("is_seed").eq("id", userId).maybeSingle().throwOnError(),
  ]);
  if (!item || !seller) return null;
  const category = Category.safeParse(item.category);
  if (item.status !== "passing_on" || !category.success || category.data === "accessory") {
    return "not_passing_on";
  }

  const pool = await buyerPool(db, { id: userId, isSeed: seller.is_seed }, { category: category.data, size: item.size });
  if (pool.state !== "ok") return pool;
  const matches = await sellerMatches(db, itemId, pool.buyerIds);
  // Nothing runs the buy checks yet, so buyers who were never checked read
  // as no buyers for now.
  if (matches.state === "unchecked") return { state: "no_buyers" };
  return matches;
}
