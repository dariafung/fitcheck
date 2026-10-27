import type { ItemTags } from "../schemas/common";

// One line per item for prompts: title, then the tags the model can use.
export function describeItem(title: string, tags: ItemTags): string {
  const parts = [
    tags.subcategory ? `${tags.category} (${tags.subcategory})` : tags.category,
    tags.colors.length > 0 && `colors ${tags.colors.map((c) => c.name).join(", ")}`,
    tags.colorFamily && `color family ${tags.colorFamily}`,
    tags.pattern && `pattern ${tags.pattern}`,
    tags.materials.length > 0 && `materials ${tags.materials.join(", ")}`,
    tags.fit && `fit ${tags.fit}`,
    `formality ${tags.formality}/5`,
    tags.occasions.length > 0 && `occasions ${tags.occasions.join(", ")}`,
    tags.notes && `notes ${tags.notes}`,
  ];
  return `${title}: ${parts.filter(Boolean).join("; ")}`;
}
