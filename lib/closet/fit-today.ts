import { rangesOverlap, TempRangeF } from "@/lib/temperature";

function field(tags: unknown, key: string): unknown {
  return typeof tags === "object" && tags !== null ? (tags as Record<string, unknown>)[key] : undefined;
}

// The item's comfortable range: the user's edit first, then the AI's estimate,
// same order as effectiveTags(). Read by hand so it works before and after
// tempRangeF lands in the shared ItemTags schema. Invalid values are ignored.
export function itemTempRange(row: { ai_tags: unknown; user_tags: unknown }): TempRangeF | null {
  for (const tags of [row.user_tags, row.ai_tags]) {
    const range = TempRangeF.safeParse(field(tags, "tempRangeF"));
    if (range.success) return range.data;
  }
  return null;
}

// Items without a range fit any day.
export function fitsToday(range: TempRangeF | null, today: TempRangeF): boolean {
  return range === null || rangesOverlap(range, today);
}

// Active items that suit today's temps; without today's weather, every active
// item. Order is kept.
export function goodForToday<T extends { status: string; tempRangeF: TempRangeF | null }>(
  items: T[],
  today: TempRangeF | null,
): T[] {
  return items.filter(
    (item) => item.status === "active" && (today === null || fitsToday(item.tempRangeF, today)),
  );
}
