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

export interface ClosetGroups<T> {
  good: T[];
  notToday: T[];
  passingOn: T[];
}

// Without today's weather every active item counts as good. Order is kept.
export function groupForToday<T extends { status: string; tempRangeF: TempRangeF | null }>(
  items: T[],
  today: TempRangeF | null,
): ClosetGroups<T> {
  const groups: ClosetGroups<T> = { good: [], notToday: [], passingOn: [] };
  for (const item of items) {
    if (item.status === "passing_on") groups.passingOn.push(item);
    else if (today === null || fitsToday(item.tempRangeF, today)) groups.good.push(item);
    else groups.notToday.push(item);
  }
  return groups;
}
