import { ItemTags } from "@/lib/ai/schemas/common";
import { effectiveTags } from "@/lib/db/items";
import { CATEGORY_LABELS, FIELD_LABELS, capitalize, formalityLabel } from "./labels";

const UserTags = ItemTags.partial();

const CATEGORY_NAMES = new Map<string, string>(CATEGORY_LABELS);

export function categoryLabel(category: string): string {
  return CATEGORY_NAMES.get(category) ?? category;
}

// Drops an invalid colorFamily or tempRangeF, so one bad value doesn't
// throw away the rest of the tags. A missing one stays missing: an explicit
// undefined in user_tags would wipe out the AI's value when they are merged.
function withoutInvalidExtras(tags: unknown): unknown {
  if (typeof tags !== "object" || tags === null) return tags;
  const { colorFamily, tempRangeF, ...rest } = tags as Record<string, unknown>;
  return {
    ...rest,
    ...(colorFamily !== undefined && UserTags.shape.colorFamily.safeParse(colorFamily).success && { colorFamily }),
    ...(tempRangeF !== undefined && UserTags.shape.tempRangeF.safeParse(tempRangeF).success && { tempRangeF }),
  };
}

// Tags as the closet shows them: AI tags with user corrections on top. Items
// without valid AI tags (e.g. entered by hand) still get their category.
export function itemTags(row: {
  category: string;
  ai_tags: unknown;
  user_tags: unknown;
}): ItemTags {
  const base = aiTags(row);
  const user = UserTags.safeParse(withoutInvalidExtras(row.user_tags));
  const merged = ItemTags.safeParse(effectiveTags(base, user.success ? user.data : null));
  return merged.success ? merged.data : base;
}

// The AI's tags, or for items without valid ones (e.g. entered by hand) a
// plain set built from the category. user_tags hold only what differs from this.
export function aiTags(row: { category: string; ai_tags: unknown }): ItemTags {
  const ai = ItemTags.safeParse(withoutInvalidExtras(row.ai_tags));
  if (ai.success) return ai.data;
  // Parsed rather than typed out, so the fallback survives schema changes
  // (keys the schema does not know are dropped).
  return ItemTags.parse({
    category: row.category,
    colors: [],
    materials: [],
    formality: 3,
    seasons: [],
    occasions: [],
  });
}

export interface TagGroup {
  label: string;
  values: string[];
}

// Display groups for the item page, named and ordered like the entry card's
// fields; empty groups are dropped. The AI's finer type ("button-down") rides
// along with the type, since the card has no field for it.
export function tagGroups(tags: ItemTags): TagGroup[] {
  const type = categoryLabel(tags.category);
  const groups: TagGroup[] = [
    {
      label: FIELD_LABELS.category,
      values: [tags.subcategory ? `${type} · ${capitalize(tags.subcategory)}` : type],
    },
    { label: FIELD_LABELS.fit, values: tags.fit ? [tags.fit] : [] },
    { label: FIELD_LABELS.colorFamily, values: tags.colorFamily ? [tags.colorFamily] : [] },
    { label: FIELD_LABELS.colors, values: tags.colors.map((c) => c.name) },
    { label: FIELD_LABELS.pattern, values: tags.pattern ? [tags.pattern] : [] },
    { label: FIELD_LABELS.materials, values: tags.materials },
    { label: FIELD_LABELS.formality, values: [formalityLabel(tags.formality)] },
    {
      label: FIELD_LABELS.tempRangeF,
      values: [tags.tempRangeF ? `${tags.tempRangeF.min} to ${tags.tempRangeF.max}°F` : "any weather"],
    },
    { label: FIELD_LABELS.occasions, values: tags.occasions },
  ];
  return groups
    .map((g) => ({ ...g, values: g.values.map(capitalize) }))
    .filter((g) => g.values.length > 0);
}
