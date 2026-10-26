import type { ItemTags } from "@/lib/ai/schemas/common";
import { stableStringify } from "@/lib/ai/hash";

// The fields the user changed, for items.user_tags. effectiveTags() lays
// these over ai_tags, so only real changes are stored.
export function changedTags(aiTags: ItemTags, edited: ItemTags): Partial<ItemTags> {
  const changed: Partial<ItemTags> = {};
  for (const key of Object.keys(edited) as (keyof ItemTags)[]) {
    if (stableStringify(edited[key]) !== stableStringify(aiTags[key])) {
      Object.assign(changed, { [key]: edited[key] });
    }
  }
  return changed;
}
