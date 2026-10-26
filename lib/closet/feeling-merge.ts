import { FeelingStructured } from "@/lib/ai/schemas/common";

// Re-editing a feeling keeps what the old text said unless the new text says
// otherwise: a field the new text gives a different answer for takes the new
// answer; a field the new text does not mention keeps the old one.
export function mergeFeeling(
  previous: unknown,
  next: FeelingStructured,
): FeelingStructured {
  const old = FeelingStructured.safeParse(previous);
  if (!old.success) return next;
  const prev = old.data;

  const areas = new Map(prev.bodyAreas.map((a) => [key(a.area), a]));
  for (const a of next.bodyAreas) areas.set(key(a.area), a);

  return {
    flattering: next.flattering === "unknown" ? prev.flattering : next.flattering,
    liked: next.liked === "unknown" ? prev.liked : next.liked,
    bodyAreas: [...areas.values()],
    occasions: union(next.occasions, prev.occasions),
    mood: union(next.mood, prev.mood),
    summary: next.summary || prev.summary,
  };
}

function key(value: string): string {
  return value.trim().toLowerCase();
}

// New values first; old ones the new text did not repeat follow.
function union(first: string[], second: string[]): string[] {
  const seen = new Set<string>();
  return [...first, ...second].filter((v) => {
    const k = key(v);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
