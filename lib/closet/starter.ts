// The cold start: a new closet is asked for its 5 most-worn pieces first.
// A suggestion only: nothing waits for it, and nothing is stored. Progress
// is the count of active items. No imports: the client bundles this file.

export const STARTER_TARGET = 5;

export interface StarterProgress {
  count: number;
  target: number;
  left: number;
}

// How far along a closet with `activeCount` active items is, or null once
// it has reached the target: from then on nothing about it shows.
export function starterProgress(activeCount: number): StarterProgress | null {
  const count = Math.max(0, Math.floor(activeCount));
  if (count >= STARTER_TARGET) return null;
  return { count, target: STARTER_TARGET, left: STARTER_TARGET - count };
}

// "3 of 5"
export function starterLabel(progress: StarterProgress): string {
  return `${progress.count} of ${progress.target}`;
}

// Said right after a save, with `activeCount` counting the new item: how
// many are left, or that the closet just got there. Null past the target.
export function starterAfterSave(activeCount: number): { reached: boolean; text: string } | null {
  if (activeCount === STARTER_TARGET) return { reached: true, text: `That's your first ${STARTER_TARGET}.` };
  const progress = starterProgress(activeCount);
  if (!progress) return null;
  return { reached: false, text: `${progress.left} more to go for your first ${progress.target}.` };
}

// A purchase check against fewer pieces than the target shows its score and
// parts but no verdict; this line stands in for it. Null for an empty closet
// (the result page has its own words for that) and from the target up.
export function smallClosetNote(closetSize: number): string | null {
  if (closetSize <= 0 || closetSize >= STARTER_TARGET) return null;
  return `Based on ${closetSize} ${closetSize === 1 ? "piece" : "pieces"}. Add more for a verdict.`;
}
