// Who could buy a passing-on item: code-only filters, run before any buy
// check (which costs money). Opted-in users with every size filled in and a
// closet to compare with, then the item's size against theirs.
import type { Category } from "@/lib/ai/schemas/common";
import type { Db } from "@/lib/db/server";
import { LetterSize, ShoeSize, readSize, sizeFits, type BuyerSizes } from "./size";

// A buy check on an emptier closet can't get past the threshold.
export const MIN_BUYER_CLOSET = 3;

export interface PoolBuyer {
  id: string;
  sizes: BuyerSizes;
}

export type Pool = { state: "no_buyers" } | { state: "no_size_match" } | { state: "ok"; buyerIds: string[] };

// The buyers whose sizes fit the item. A size that can't be read, or no size
// (items passed on before sizes existed), filters no one.
export function filterBySize(buyers: PoolBuyer[], size: string | null, category: Category): Pool {
  if (buyers.length === 0) return { state: "no_buyers" };
  const read = size === null ? null : readSize(size, category);
  const fit = read ? buyers.filter((b) => sizeFits(read, category, b.sizes)) : buyers;
  return fit.length > 0 ? { state: "ok", buyerIds: fit.map((b) => b.id) } : { state: "no_size_match" };
}

// Real users are only matched with real users, and the demo persona only
// with the seeded sample buyers. The seller is never their own buyer.
export async function buyerPool(
  db: Db,
  seller: { id: string; isSeed: boolean },
  item: { category: Category; size: string | null },
): Promise<Pool> {
  const { data: users } = await db
    .from("users")
    .select("id, top_size, bottom_size, shoe_size")
    .eq("resale_opt_in", true)
    .eq("is_seed", seller.isSeed)
    .neq("id", seller.id)
    .throwOnError();

  const sized: PoolBuyer[] = users.flatMap((u) => {
    const top = LetterSize.safeParse(u.top_size);
    const bottom = LetterSize.safeParse(u.bottom_size);
    const shoe = ShoeSize.safeParse(u.shoe_size);
    if (!top.success || !bottom.success || !shoe.success) return [];
    return [{ id: u.id, sizes: { top: top.data, bottom: bottom.data, shoe: shoe.data } }];
  });
  if (sized.length === 0) return { state: "no_buyers" };

  const { data: items } = await db
    .from("items")
    .select("user_id")
    .eq("status", "active")
    .in(
      "user_id",
      sized.map((b) => b.id),
    )
    .throwOnError();
  const closetSize = new Map<string, number>();
  for (const { user_id } of items) closetSize.set(user_id, (closetSize.get(user_id) ?? 0) + 1);

  const buyers = sized.filter((b) => (closetSize.get(b.id) ?? 0) >= MIN_BUYER_CLOSET);
  return filterBySize(buyers, item.size, item.category);
}
