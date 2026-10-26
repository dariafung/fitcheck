import { z } from "zod";
import type { ItemSummary, ItemTags } from "@/lib/ai/schemas/common";
import type { Json } from "@/lib/db/database.types";
import type { Db } from "@/lib/db/server";
import { latestFeeling } from "./feelings";
import type { TempRangeF } from "@/lib/temperature";
import { itemTempRange } from "./fit-today";
import { imageUrls } from "./images";
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
}

export interface ClosetItem {
  id: string;
  title: string;
  brand: string | null;
  retailer: string | null;
  sourceUrl: string | null;
  category: string;
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
  const { data } = await db
    .from("items")
    .select("id, title, category, status, image_paths, ai_tags, user_tags")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("title")
    .throwOnError();

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
    };
  });
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
    .select("id, title, brand, retailer, source_url, category, image_paths, ai_tags, user_tags")
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
    tags: itemTags(data),
    tempRangeF: itemTempRange(data),
    swatch: swatchHex(data),
    imageUrls: urls,
    feeling: feeling ? { text: feeling.raw_text } : null,
  };
}

// A range the user set by hand goes into user_tags, next to any other
// corrections already there; AI tags are left as they are.
export async function updateItemTempRange(
  db: Db,
  userId: string,
  id: string,
  tempRangeF: TempRangeF,
): Promise<TempRangeF | null> {
  if (!isItemId(id)) return null;
  const { data } = await db
    .from("items")
    .select("user_tags")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()
    .throwOnError();
  if (!data) return null;

  const userTags = isRecord(data.user_tags) ? data.user_tags : {};
  const { data: updated } = await db
    .from("items")
    .update({ user_tags: { ...userTags, tempRangeF } })
    .eq("id", id)
    .select("ai_tags, user_tags")
    .single()
    .throwOnError();
  return itemTempRange(updated);
}

function isRecord(value: unknown): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
