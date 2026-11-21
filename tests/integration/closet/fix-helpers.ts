import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { FeelingStructured } from "@/lib/ai/schemas/common";
import { createServerClient } from "@/lib/db/server";
import { ITEM_IMAGES_BUCKET } from "@/lib/entry/images";

const PIECES = [
  { key: "tee", title: "Test beige tee", category: "top" },
  { key: "jeans", title: "Test dark jeans", category: "bottom" },
  { key: "sneakers", title: "Test sneakers", category: "shoes" },
  { key: "blazer", title: "Test black blazer", category: "outerwear" },
] as const;

type PieceKey = (typeof PIECES)[number]["key"];

export const complaint = (said = "washes me out", aspect: "color" | "other" = "color"): FeelingStructured => ({
  flattering: "no",
  liked: "mixed",
  aspects: [
    { aspect: "feel", sentiment: "positive", said: "soft", means: "soft fabric" },
    { aspect, sentiment: "negative", said, means: said },
  ],
  occasions: [],
  mood: [],
  summary: "Soft, with a complaint.",
});

export const onlyGood = (): FeelingStructured => ({
  flattering: "yes",
  liked: "yes",
  aspects: [{ aspect: "color", sentiment: "positive", said: "love the color", means: "the color suits them" }],
  occasions: [],
  mood: [],
  summary: "Loves it.",
});

const tags = (category: string, tempRangeF = { min: 50, max: 80 }) => ({
  category,
  colors: [{ name: "plain" }],
  materials: ["cotton"],
  formality: 2,
  occasions: ["school"],
  tempRangeF,
});

// A throwaway user with a tee, jeans, sneakers and a blazer, comfortable in
// the same temperatures. The local database is shared, so everything sits
// under a random user that `cleanup` deletes (items, feelings, suggestions
// and saved outfits cascade; photos are removed from storage).
export async function fixCloset() {
  const db = createServerClient();
  const userId = randomUUID();
  const photos: string[] = [];
  await db.from("users").insert({ id: userId, display_name: "Fix test user" }).throwOnError();
  const { data } = await db
    .from("items")
    .insert(PIECES.map((p) => ({ user_id: userId, entry_method: "manual", title: p.title, category: p.category, ai_tags: tags(p.category) })))
    .select("id, title")
    .throwOnError();
  const ids = Object.fromEntries(PIECES.map((p) => [p.key, data.find((row) => row.title === p.title)!.id])) as Record<PieceKey, string>;

  // One more active item; its id.
  async function add(title: string, category: string, tempRangeF?: { min: number; max: number }): Promise<string> {
    const { data: row } = await db
      .from("items")
      .insert({ user_id: userId, entry_method: "manual", title, category, ai_tags: tags(category, tempRangeF) })
      .select("id")
      .single()
      .throwOnError();
    return row.id;
  }

  async function rate(key: PieceKey, rating: number | null) {
    await db.from("items").update({ rating }).eq("id", ids[key]).throwOnError();
  }

  // The item's feeling, parsed unless `parsed` is false.
  async function feel(key: PieceKey, structured: FeelingStructured | null, parsed = true) {
    await db.from("item_feelings").delete().eq("item_id", ids[key]).throwOnError();
    await db
      .from("item_feelings")
      .insert({
        item_id: ids[key],
        user_id: userId,
        raw_text: "Test note.",
        source: "typed",
        structured,
        parsed_at: parsed ? new Date().toISOString() : null,
      })
      .throwOnError();
  }

  // Gives the item a stored photo.
  async function photograph(key: PieceKey) {
    const path = `${userId}/${randomUUID()}.webp`;
    const webp = await sharp({ create: { width: 200, height: 250, channels: 3, background: "#d8c8a8" } }).webp().toBuffer();
    const { error } = await db.storage.from(ITEM_IMAGES_BUCKET).upload(path, webp, { contentType: "image/webp" });
    if (error) throw error;
    photos.push(path);
    await db.from("items").update({ image_paths: [path] }).eq("id", ids[key]).throwOnError();
  }

  async function storedFix(key: PieceKey) {
    const { data: row } = await db
      .from("item_fix_outfits")
      .select("input_hash, prompt_version, outfit_item_ids, reason")
      .eq("item_id", ids[key])
      .maybeSingle()
      .throwOnError();
    return row;
  }

  async function cleanup() {
    if (photos.length > 0) await db.storage.from(ITEM_IMAGES_BUCKET).remove(photos);
    await db.from("users").delete().eq("id", userId).throwOnError();
  }

  return { db, userId, ...ids, add, rate, feel, photograph, storedFix, cleanup };
}

export const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

export function request(method: string, url: string, body?: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
