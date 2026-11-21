// The pure parts of "an outfit for a piece you're unhappy with".

// Sorted and unique: how an outfit is stored, and what makes two the same.
export function outfitKey(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.toLowerCase()))].sort();
}
