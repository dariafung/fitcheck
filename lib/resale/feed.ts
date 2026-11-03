// "Suits you": what other people are passing on that the buy check, run from
// this user's side, scored high for them. Read only from the cached checks
// (resale_matches); opening home never runs a check. Of the seller, only the
// name they picked (users.display_name) is read: never their email, closet
// or anything else. (The seller never learns who the buyers are.)
import type { AiMode } from "@/lib/ai/mode";
import { Category } from "@/lib/ai/schemas/common";
import { imageUrls } from "@/lib/closet/images";
import { swatchHex } from "@/lib/closet/swatch";
import type { Db } from "@/lib/db/server";
import { toSellerItem } from "./buyers";
import { nicknameOrDefault } from "@/lib/profile/nickname";
import { buyerStates, fingerprint } from "./fingerprint";
import { RESALE_SCORE_THRESHOLD } from "./matches";

// Most pieces shown at once.
export const MAX_FEED = 6;

export interface FeedPiece {
  id: string;
  title: string;
  category: string;
  size: string | null;
  askingPriceCents: number | null;
  condition: string | null;
  imageUrl: string | null;
  swatch: string;
  // The buyer's own reasons from their check.
  reasons: string[];
  // The name the seller picked; DEFAULT_NICKNAME when theirs isn't usable.
  sellerName: string;
}

// The user's strong matches, best first: still passing on, not an accessory,
// and checked on what this user's closet, profile and card are now (the same
// fingerprint the seller's count goes by). Empty for anyone not opted in.
export async function suitsYou(db: Db, userId: string, mode: AiMode): Promise<FeedPiece[]> {
  const { data: user } = await db.from("users").select("resale_opt_in").eq("id", userId).maybeSingle().throwOnError();
  if (!user?.resale_opt_in) return [];
  const { data: matches } = await db
    .from("resale_matches")
    .select("item_id, fingerprint, score, buyer_reasons")
    .eq("buyer_id", userId)
    .gte("score", RESALE_SCORE_THRESHOLD)
    .order("score", { ascending: false })
    .throwOnError();
  if (matches.length === 0) return [];

  const [{ data: items }, states] = await Promise.all([
    db
      .from("items")
      .select(
        "id, user_id, title, category, status, size, asking_price_cents, condition, image_paths, ai_tags, user_tags",
      )
      .in(
        "id",
        matches.map((m) => m.item_id),
      )
      .eq("status", "passing_on")
      .neq("user_id", userId)
      .throwOnError(),
    buyerStates(db, [userId]),
  ]);
  const state = states.get(userId);
  if (!state) return [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const fresh = matches.flatMap((m) => {
    const item = byId.get(m.item_id);
    if (!item) return [];
    const category = Category.safeParse(item.category);
    if (!category.success || category.data === "accessory") return [];
    if (fingerprint(toSellerItem(item), state, mode) !== m.fingerprint) return [];
    return [{ item, reasons: m.buyer_reasons }];
  });
  const shown = fresh.slice(0, MAX_FEED);
  const [urls, { data: sellers }] = await Promise.all([
    imageUrls(
      db,
      shown.flatMap(({ item }) => item.image_paths.slice(0, 1)),
    ),
    db
      .from("users")
      .select("id, display_name")
      .in("id", [...new Set(shown.map(({ item }) => item.user_id))])
      .throwOnError(),
  ]);
  const names = new Map(sellers.map((s) => [s.id, s.display_name]));
  let next = 0;
  return shown.map(({ item, reasons }) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    size: item.size,
    askingPriceCents: item.asking_price_cents,
    condition: item.condition,
    imageUrl: item.image_paths.length > 0 ? (urls[next++] ?? null) : null,
    swatch: swatchHex(item),
    reasons,
    sellerName: nicknameOrDefault(names.get(item.user_id)),
  }));
}
