import { ItemTags, type Category } from "../ai/schemas/common";
import { COLOR_FAMILIES, type ColorFamily } from "../color-families";
import { TempRangeF } from "../temperature";

// An item as the pairing logic sees it.
export interface ClosetItem {
  id: string;
  title: string;
  // Effective tags (user edits win); what the model sees.
  tags: ItemTags;
  // Missing means any temperature.
  tempRangeF?: TempRangeF;
  colorFamily?: ColorFamily;
  // items.updated_at; a cached verdict older than this is stale.
  updatedAt?: string;
}

// tempRangeF and colorFamily are read from the raw tags object, so this
// works whether or not ItemTags declares them yet. Invalid values are ignored.
export function readTempRange(rawTags: unknown): TempRangeF | undefined {
  const value = (rawTags as { tempRangeF?: unknown } | null)?.tempRangeF;
  const parsed = TempRangeF.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function readColorFamily(rawTags: unknown): ColorFamily | undefined {
  const value = (rawTags as { colorFamily?: unknown } | null)?.colorFamily;
  return COLOR_FAMILIES.find((family) => family === value);
}

// Drops an invalid tempRangeF or colorFamily, so one bad value doesn't
// invalidate the rest of the tags.
function withoutInvalidExtras(rawTags: unknown): unknown {
  if (typeof rawTags !== "object" || rawTags === null) return rawTags;
  const { tempRangeF, colorFamily, ...rest } = rawTags as Record<string, unknown>;
  return {
    ...rest,
    ...(readTempRange(rawTags) && { tempRangeF }),
    ...(readColorFamily(rawTags) && { colorFamily }),
  };
}

// Null when the tags don't validate (e.g. extraction not finished).
export function toClosetItem(
  id: string,
  title: string,
  rawTags: unknown,
  updatedAt?: string,
): ClosetItem | null {
  const cleaned = withoutInvalidExtras(rawTags);
  const parsed = ItemTags.safeParse(cleaned);
  if (!parsed.success) return null;
  return {
    id,
    title,
    // Keep keys ItemTags doesn't know yet, so they round-trip.
    tags: { ...(cleaned as object), ...parsed.data },
    tempRangeF: readTempRange(rawTags),
    colorFamily: readColorFamily(rawTags),
    updatedAt,
  };
}

export function categoryOf(item: ClosetItem): Category {
  return item.tags.category;
}

// The pairings table stores each pair once with item_a_id < item_b_id.
// Postgres orders uuids bytewise, which matches lowercase string order.
export function orderPair(x: string, y: string): [string, string] {
  const a = x.toLowerCase();
  const b = y.toLowerCase();
  return a < b ? [a, b] : [b, a];
}

export function pairKey(x: string, y: string): string {
  const [a, b] = orderPair(x, y);
  return `${a}:${b}`;
}

export type Compatible = (a: ClosetItem, b: ClosetItem) => boolean;
