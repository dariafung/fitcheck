import { ItemTags, type Category } from "@/lib/ai/schemas/common";
import { effectiveTags } from "@/lib/db/items";

const UserTags = ItemTags.partial();

const CATEGORY_LABELS: Record<Category, string> = {
  top: "Top",
  bottom: "Bottom",
  one_piece: "One-piece",
  shoes: "Shoes",
  outerwear: "Outerwear",
  accessory: "Accessory",
};

const FORMALITY_LABELS = ["Very casual", "Casual", "Smart casual", "Dressy", "Formal"];

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as Category] ?? category;
}

// Tags as the closet shows them: AI tags with user corrections on top. Items
// without valid AI tags (e.g. entered by hand) still get their category.
export function itemTags(row: {
  category: string;
  ai_tags: unknown;
  user_tags: unknown;
}): ItemTags {
  const ai = ItemTags.safeParse(row.ai_tags);
  const user = UserTags.safeParse(row.user_tags);
  // Parsed rather than typed out, so the fallback survives schema changes
  // (keys the schema does not know are dropped).
  const base: ItemTags = ai.success
    ? ai.data
    : ItemTags.parse({
        category: row.category,
        colors: [],
        materials: [],
        formality: 3,
        seasons: [],
        occasions: [],
      });
  const merged = ItemTags.safeParse(effectiveTags(base, user.success ? user.data : null));
  return merged.success ? merged.data : base;
}

export interface TagGroup {
  label: string;
  values: string[];
}

// Display groups for the detail page; empty groups are dropped. The comfortable
// temperature range is shown separately, as an editable row.
export function tagGroups(tags: ItemTags): TagGroup[] {
  const groups: TagGroup[] = [
    { label: "Type", values: tags.subcategory ? [tags.subcategory] : [] },
    { label: "Color", values: tags.colors.map((c) => c.name) },
    { label: "Pattern", values: tags.pattern ? [tags.pattern] : [] },
    { label: "Material", values: tags.materials },
    { label: "Fit", values: tags.fit ? [tags.fit] : [] },
    { label: "Vibe", values: [FORMALITY_LABELS[tags.formality - 1]] },
    { label: "For", values: tags.occasions },
  ];
  return groups
    .map((g) => ({ ...g, values: g.values.map(capitalize) }))
    .filter((g) => g.values.length > 0);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
