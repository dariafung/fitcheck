import type { ItemTags } from "../ai/schemas/common";

// User corrections win over AI tags, field by field.
export function effectiveTags(
  aiTags: ItemTags,
  userTags: Partial<ItemTags> | null | undefined,
): ItemTags {
  return { ...aiTags, ...userTags };
}
