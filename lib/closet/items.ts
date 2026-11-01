import { z } from "zod";
import type { ItemSummary, ItemTags } from "@/lib/ai/schemas/common";
import type { Db } from "@/lib/db/server";
import { latestFeeling } from "./feelings";
import type { TempRangeF } from "@/lib/temperature";
import { itemTempRange } from "./fit-today";
import { ITEM_IMAGES_BUCKET, imageUrls, isExternalUrl } from "./images";
import type { ItemPatch } from "./item-patch";
import { itemUpdate, needsSize } from "./item-update";
import { swatchHex } from "./swatch";
import { itemTags } from "./tags";

export interface ClosetCard {
  id: string;
  title: string;
  category: string;
  status: string;
  tempRangeF: TempRangeF | null;
  imageUrl: string | null;
  // Color-family swatch for the placeholder when there is no photo.
  swatch: string;
  // The one-line summary of its latest feeling, once the AI has read it.
  note: string | null;
  // With user corrections, for the closet's occasion filters.
  occasions: string[];
}

export interface ClosetItem {
  id: string;
  title: string;
  brand: string | null;
  retailer: string | null;
  sourceUrl: string | null;
  category: string;
  // "active" or "passing_on".
  status: string;
  // As the owner typed it; needed while passing_on.
  size: string | null;
  tags: ItemTags;
  tempRangeF: TempRangeF | null;
  swatch: string;
  imageUrls: string[];
  // Only the raw text: structured fields stay in the backend.
  feeling: { text: string } | null;
}

const ItemId = z.uuid();

export function isItemId(id: string): boolean {
  return ItemId.safeParse(id).success;
}

export async function listClosetItems(db: Db, userId: string): Promise<ClosetCard[]> {
  const [{ data }, { data: feelings }] = await Promise.all([
    db
      .from("items")
      .select("id, title, category, status, image_paths, ai_tags, user_tags")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("title")
      .throwOnError(),
    db
      .from("item_feelings")
      .select("item_id, structured")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .throwOnError(),
  ]);

  // The latest feeling per item; no note while it hasn't been read yet.
  const notes = new Map<string, string | null>();
  for (const row of feelings) {
    if (!notes.has(row.item_id)) notes.set(row.item_id, feelingNote(row.structured));
  }
  const firstImages = await imageUrls(
    db,
    data.flatMap((row) => row.image_paths.slice(0, 1)),
  );
  let next = 0;
  return data.map((row) => {
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      status: row.status,
      tempRangeF: itemTempRange(row),
      imageUrl: row.image_paths.length > 0 ? (firstImages[next++] ?? null) : null,
      swatch: swatchHex(row),
      note: notes.get(row.id) ?? null,
      occasions: itemTags(row).occasions,
    };
  });
}

function feelingNote(structured: unknown): string | null {
  const summary = (structured as { summary?: unknown } | null)?.summary;
  return typeof summary === "string" && summary.trim() !== "" ? summary.trim() : null;
}

// What the closet knows about one item, or null when it is not this user's.
export async function findItemSummary(
  db: Db,
  userId: string,
  id: string,
): Promise<ItemSummary | null> {
  if (!isItemId(id)) return null;
  const { data } = await db
    .from("items")
    .select("id, title, category, ai_tags, user_tags")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()
    .throwOnError();
  return data ? { id: data.id, title: data.title, tags: itemTags(data) } : null;
}

export async function getClosetItem(
  db: Db,
  userId: string,
  id: string,
): Promise<ClosetItem | null> {
  if (!isItemId(id)) return null;
  const { data } = await db
    .from("items")
    .select("id, title, brand, retailer, source_url, category, status, size, image_paths, ai_tags, user_tags")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()
    .throwOnError();
  if (!data) return null;

  const [urls, feeling] = await Promise.all([
    imageUrls(db, data.image_paths),
    latestFeeling(db, data.id),
  ]);
  return {
    id: data.id,
    title: data.title,
    brand: data.brand,
    retailer: data.retailer,
    sourceUrl: data.source_url,
    category: data.category,
    status: data.status,
    size: data.size,
    tags: itemTags(data),
    tempRangeF: itemTempRange(data),
    swatch: swatchHex(data),
    imageUrls: urls,
    feeling: feeling ? { text: feeling.raw_text } : null,
  };
}

// Applies a PATCH to one of the user's items: new details (name, brand, tags
// as user corrections), a new status and/or a new size. "not_found" when it
// is not theirs; "size_required" when it would be passing on without a size.
// Changing tags bumps updated_at, which marks its cached pairings stale.
export async function updateClosetItem(
  db: Db,
  userId: string,
  id: string,
  patch: ItemPatch,
): Promise<"updated" | "not_found" | "size_required"> {
  if (!isItemId(id)) return "not_found";
  const { data } = await db
    .from("items")
    .select("title, brand, category, status, size, ai_tags, user_tags")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()
    .throwOnError();
  if (!data) return "not_found";
  if (needsSize(data, patch)) return "size_required";

  const update = itemUpdate(data, patch);
  if (update) {
    await db.from("items").update(update).eq("id", id).eq("user_id", userId).throwOnError();
  }
  return "updated";
}

// Deletes one of the user's items; false when it is not theirs. Its feeling
// and its pairings go with it (on delete cascade), then its photos in the
// item-images bucket. A photo that fails to delete is left to the daily cron,
// which removes images no item points to.
export async function deleteClosetItem(db: Db, userId: string, id: string): Promise<boolean> {
  if (!isItemId(id)) return false;
  const { data } = await db
    .from("items")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("image_paths")
    .maybeSingle()
    .throwOnError();
  if (!data) return false;

  const stored = data.image_paths.filter((p) => !isExternalUrl(p));
  if (stored.length > 0) {
    const { error } = await db.storage.from(ITEM_IMAGES_BUCKET).remove(stored);
    if (error) console.error(`Could not delete images of item ${id}:`, error);
  }
  return true;
}
