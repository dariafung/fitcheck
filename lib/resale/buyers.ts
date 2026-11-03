// "Matching buyers" for one of the user's passing-on items.
import { currentMode } from "@/lib/ai/mode";
import { Category } from "@/lib/ai/schemas/common";
import type { Db } from "@/lib/db/server";
import { isItemId } from "@/lib/closet/items";
import { itemTags } from "@/lib/closet/tags";
import { checkBuyers, type BuyCheckAi } from "./check-buyers";
import { buyerStates, fingerprint, type SellerItem } from "./fingerprint";
import { sellerMatches, type SellerMatches } from "./matches";
import { buyerPool } from "./pool";

// seeded: the seller is the demo persona, matched with the seed neighbors only.
export type BuyersResult = ({ state: "no_buyers" } | { state: "no_size_match" } | SellerMatches) & {
  seeded: boolean;
};

// The seller's item as each buyer's check gets it.
export function toSellerItem(row: {
  title: string;
  category: string;
  ai_tags: unknown;
  user_tags: unknown;
  image_paths: string[];
}): SellerItem {
  return { title: row.title, tags: itemTags(row), photoPath: row.image_paths[0] ?? null };
}

// Null when the item isn't the user's; "not_passing_on" when it isn't on its
// way out (or is an accessory, which isn't matched). Checks the buyers whose
// cached check is missing or out of date first, a few at a time.
export async function findBuyers(
  db: Db,
  userId: string,
  itemId: string,
  ai: BuyCheckAi,
): Promise<BuyersResult | "not_passing_on" | null> {
  if (!isItemId(itemId)) return null;
  const [{ data: item }, { data: seller }] = await Promise.all([
    db
      .from("items")
      .select("title, category, status, size, ai_tags, user_tags, image_paths")
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
  const seeded = seller.is_seed;

  const pool = await buyerPool(db, { id: userId, isSeed: seeded }, { category: category.data, size: item.size });
  if (pool.state !== "ok") return { ...pool, seeded };

  const sellerItem = toSellerItem(item);
  const mode = currentMode();
  const states = [...(await buyerStates(db, pool.buyerIds)).values()];
  const buyers = states.map((state) => ({ state, fingerprint: fingerprint(sellerItem, state, mode) }));
  await checkBuyers(db, { sellerId: userId, itemId, item: sellerItem }, buyers, ai);
  const fingerprints = new Map(buyers.map((b) => [b.state.id, b.fingerprint]));

  return { ...(await sellerMatches(db, itemId, fingerprints)), seeded };
}
