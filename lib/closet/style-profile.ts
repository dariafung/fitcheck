// The style card on home (P1-3): one per user, built by buildProfile from the
// active items and their parsed feelings, and rebuilt when those change.
import { z } from "zod";
import { inputHash } from "@/lib/ai/hash";
import {
  BuildProfileInput,
  PROFILE_TOPICS,
  PROMPT_VERSION,
  ProfileStatement,
  type BuildProfileOutput,
  type ProfileTopic,
} from "@/lib/ai/schemas/build-profile";
import { FeelingStructured } from "@/lib/ai/schemas/common";
import { DEMO_USER_ID } from "@/lib/db/demo-user";
import type { Db } from "@/lib/db/server";
import { itemTags } from "./tags";

// Fewer parsed feelings than this and there's too little to sum up.
export const MIN_FEELINGS = 3;
// A card shows only with its headline and at least this many rows.
export const MIN_ROWS = 3;
// At most one regeneration per user per cooldown, whatever happens to it.
export const REGENERATE_COOLDOWN = "1 minute";
// The seed card shown until the persona's real one is recorded.
export const PLACEHOLDER_VERSION = "placeholder";

export type BuildFn = (input: BuildProfileInput) => Promise<BuildProfileOutput>;

type ProfileInput = z.output<typeof BuildProfileInput>;

interface ItemRow {
  id: string;
  title: string;
  category: string;
  ai_tags: unknown;
  user_tags?: unknown;
}

interface FeelingRow {
  item_id: string;
  structured: unknown;
}

// What buildProfile sees, sorted by id so the same closet always hashes the
// same. Each item's feeling counts with the structured fields it has now:
// while a re-edit is being parsed the old ones stand, so the card doesn't
// change twice. Null with fewer than MIN_FEELINGS parsed feelings.
export function profileInput(items: readonly ItemRow[], feelings: readonly FeelingRow[]): ProfileInput | null {
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : 1));
  const ids = new Set(sorted.map((i) => i.id));
  const parsed = new Map<string, FeelingStructured>();
  for (const row of feelings) {
    if (!ids.has(row.item_id) || parsed.has(row.item_id)) continue;
    const feeling = FeelingStructured.safeParse(row.structured);
    if (feeling.success) parsed.set(row.item_id, feeling.data);
  }
  if (parsed.size < MIN_FEELINGS) return null;
  return BuildProfileInput.parse({
    items: sorted.map((row) => ({ id: row.id, title: row.title, tags: itemTags({ ...row, user_tags: row.user_tags }) })),
    feelings: sorted.flatMap((row) => {
      const feeling = parsed.get(row.id);
      return feeling ? [{ ...feeling, itemId: row.id }] : [];
    }),
  });
}

export function profileHash(input: ProfileInput): string {
  return inputHash("buildProfile", PROMPT_VERSION, input);
}

// The user's active items, and each one's latest feeling with structured fields.
async function loadCloset(db: Db, userId: string) {
  const [{ data: items }, { data: feelings }] = await Promise.all([
    db
      .from("items")
      .select("id, title, category, ai_tags, user_tags")
      .eq("user_id", userId)
      .eq("status", "active")
      .throwOnError(),
    db
      .from("item_feelings")
      .select("item_id, structured")
      .eq("user_id", userId)
      .not("structured", "is", null)
      .order("created_at", { ascending: false })
      .throwOnError(),
  ]);
  return { items, feelings };
}

const StoredStatements = z.array(ProfileStatement);
const StoredHeadline = z.object({ text: z.string(), evidenceItemIds: z.array(z.string()) });

export interface StoredCard {
  headline: z.infer<typeof StoredHeadline>;
  suits: ProfileStatement[];
  avoid: ProfileStatement[];
  inputHash: string;
  promptVersion: string | null;
  generatedAt: string;
}

async function loadStoredCard(db: Db, userId: string): Promise<StoredCard | null> {
  const { data } = await db
    .from("style_profiles")
    .select("headline, suits, avoid, input_hash, prompt_version, generated_at")
    .eq("user_id", userId)
    .maybeSingle()
    .throwOnError();
  if (!data?.input_hash) return null;
  const headline = StoredHeadline.safeParse(data.headline);
  const suits = StoredStatements.safeParse(data.suits);
  const avoid = StoredStatements.safeParse(data.avoid);
  if (!headline.success || !suits.success || !avoid.success) return null;
  return {
    headline: headline.data,
    suits: suits.data,
    avoid: avoid.data,
    inputHash: data.input_hash,
    promptVersion: data.prompt_version,
    // Same form as a card just built, whatever form the database returns.
    generatedAt: new Date(data.generated_at).toISOString(),
  };
}

export interface CardRow {
  topic: ProfileTopic;
  suits?: string;
  avoid?: string;
}

// What the card shows. Sources stay in the backend.
export interface VisibleCard {
  headline: string;
  rows: CardRow[];
  generatedAt: string;
}

// Statements whose items have all left the closet (deleted, or no longer
// active) are dropped, so a stale card never talks about them. Null when
// the headline goes or fewer than MIN_ROWS rows are left.
export function visibleCard(card: StoredCard, activeIds: ReadonlySet<string>): VisibleCard | null {
  const backed = (s: { evidenceItemIds: string[] }) => s.evidenceItemIds.some((id) => activeIds.has(id));
  if (!backed(card.headline)) return null;
  const rows = PROFILE_TOPICS.flatMap((topic): CardRow[] => {
    const suits = card.suits.find((s) => s.topic === topic && backed(s))?.text;
    const avoid = card.avoid.find((s) => s.topic === topic && backed(s))?.text;
    return suits || avoid ? [{ topic, ...(suits && { suits }), ...(avoid && { avoid }) }] : [];
  });
  if (rows.length < MIN_ROWS) return null;
  return { headline: card.headline.text, rows, generatedAt: card.generatedAt };
}

export interface StyleCardState {
  card: VisibleCard | null;
  // Enough parsed feelings for a card.
  enough: boolean;
  // The stored card isn't for the closet as it is now (or there is none).
  stale: boolean;
  // Whether opening home should regenerate it: never for the persona, whose
  // card comes from the seed. The read-only demo account is the persona.
  canRegenerate: boolean;
}

export async function loadStyleCardState(db: Db, userId: string): Promise<StyleCardState> {
  const [{ items, feelings }, stored] = await Promise.all([loadCloset(db, userId), loadStoredCard(db, userId)]);
  const input = profileInput(items, feelings);
  const card = stored && visibleCard(stored, new Set(items.map((i) => i.id)));
  return {
    card,
    enough: input !== null,
    stale: input !== null && stored?.inputHash !== profileHash(input),
    canRegenerate: userId !== DEMO_USER_ID,
  };
}

export type RefreshResult =
  | { status: "not_enough" }
  | { status: "busy" }
  | { status: "ready"; card: VisibleCard | null };

// Rebuilds the card if the closet changed since it was made. Only one
// request per user gets to (style_profile_claim); the rest answer busy. A
// failed build leaves the old card and rethrows.
export async function refreshStyleCard(db: Db, userId: string, build: BuildFn): Promise<RefreshResult> {
  const { items, feelings } = await loadCloset(db, userId);
  const input = profileInput(items, feelings);
  if (!input) return { status: "not_enough" };
  const activeIds = new Set(items.map((i) => i.id));
  const hash = profileHash(input);

  const stored = await loadStoredCard(db, userId);
  if (stored?.inputHash === hash) return { status: "ready", card: visibleCard(stored, activeIds) };

  const { data: token } = await db
    .rpc("style_profile_claim", { p_user: userId, p_hash: hash, p_cooldown: REGENERATE_COOLDOWN })
    .throwOnError();
  if (!token) return { status: "busy" };

  let output: BuildProfileOutput;
  try {
    output = await build(input);
  } catch (err) {
    await db.from("style_profiles").update({ generating_token: null }).eq("user_id", userId).eq("generating_token", token).throwOnError();
    throw err;
  }
  const generatedAt = new Date().toISOString();
  await db
    .from("style_profiles")
    .update({
      headline: output.headline,
      suits: output.suits,
      avoid: output.avoid,
      input_hash: hash,
      prompt_version: PROMPT_VERSION,
      generated_at: generatedAt,
      generating_token: null,
    })
    .eq("user_id", userId)
    .eq("generating_token", token)
    .throwOnError();
  const card = visibleCard({ ...output, inputHash: hash, promptVersion: PROMPT_VERSION, generatedAt }, activeIds);
  return { status: "ready", card };
}
