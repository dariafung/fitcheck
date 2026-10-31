// What one buyer's cached buy check for a passing-on item was based on.
// Anything here changes → that buyer is checked again; nothing here costs
// money to read.
import { createHash } from "node:crypto";
import { PROMPT_VERSION as JUDGE_PAIRING_VERSION } from "@/lib/ai/schemas/judge-pairing";
import { PROMPT_VERSION as JUDGE_REPEAT_VERSION } from "@/lib/ai/schemas/judge-repeat";
import { PROMPT_VERSION as SCORE_PURCHASE_VERSION } from "@/lib/ai/schemas/score-purchase";
import type { AiMode } from "@/lib/ai/mode";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { OWNED_STATUSES } from "@/lib/check/pairings";
import type { Db } from "@/lib/db/server";

export const CHECK_VERSIONS = [JUDGE_PAIRING_VERSION, SCORE_PURCHASE_VERSION, JUDGE_REPEAT_VERSION] as const;

// The seller's item as the buyer's check sees it. Its size only filters the
// pool, and its status isn't seen, so neither is here.
export interface SellerItem {
  title: string;
  tags: ItemTags;
  photoPath: string | null;
}

// What runBuyCheck reads about one buyer.
export interface BuyerState {
  id: string;
  createdAt: string;
  lifestyleMix: unknown;
  profile: { bodyShape: string | null; heightCm: number | null };
  // Active items, with updated_at: tags, photos and status all bump it.
  items: { id: string; updatedAt: string }[];
  feelings: { id: string; parsedAt: string | null }[];
  card: { inputHash: string | null; promptVersion: string | null } | null;
}

// The AI mode is in too, so scores cached by mock runs (tests) never pass for
// live ones.
export function fingerprint(item: SellerItem, buyer: BuyerState, mode: AiMode): string {
  const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const basis = {
    mode,
    versions: CHECK_VERSIONS,
    item,
    profile: buyer.profile,
    lifestyleMix: buyer.lifestyleMix,
    items: byId(buyer.items),
    feelings: byId(buyer.feelings),
    card: buyer.card,
  };
  return createHash("sha256").update(JSON.stringify(basis)).digest("hex");
}

// Each buyer's state, by id; ids with no user row are missing. Buyers are
// few (opted in and past the size filter), so one page of rows is plenty.
export async function buyerStates(db: Db, buyerIds: readonly string[]): Promise<Map<string, BuyerState>> {
  const ids = [...buyerIds];
  const states = new Map<string, BuyerState>();
  if (ids.length === 0) return states;
  const [{ data: users }, { data: items }, { data: feelings }, { data: cards }] = await Promise.all([
    db
      .from("users")
      .select("id, created_at, body_shape, height_cm, lifestyle_mix")
      .in("id", ids)
      .throwOnError(),
    db
      .from("items")
      .select("id, user_id, updated_at")
      .in("user_id", ids)
      .in("status", [...OWNED_STATUSES])
      .throwOnError(),
    db.from("item_feelings").select("id, user_id, parsed_at").in("user_id", ids).throwOnError(),
    db.from("style_profiles").select("user_id, input_hash, prompt_version").in("user_id", ids).throwOnError(),
  ]);
  for (const u of users) {
    const card = cards.find((c) => c.user_id === u.id);
    states.set(u.id, {
      id: u.id,
      createdAt: u.created_at,
      lifestyleMix: u.lifestyle_mix,
      profile: { bodyShape: u.body_shape, heightCm: u.height_cm === null ? null : Number(u.height_cm) },
      items: items.filter((i) => i.user_id === u.id).map((i) => ({ id: i.id, updatedAt: i.updated_at })),
      feelings: feelings.filter((f) => f.user_id === u.id).map((f) => ({ id: f.id, parsedAt: f.parsed_at })),
      card: card ? { inputHash: card.input_hash, promptVersion: card.prompt_version } : null,
    });
  }
  return states;
}
