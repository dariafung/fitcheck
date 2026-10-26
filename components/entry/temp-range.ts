import { TEMP_F_MAX, TEMP_F_MIN, TempRangeF } from "@/lib/temperature";

// The two °F boxes → a range, or a short note on what's wrong. Both empty
// is fine only when the model gave no range either.
export function readTempRange(low: string, high: string): { range?: TempRangeF; problem?: string } {
  if (low.trim() === "" && high.trim() === "") return {};
  // Number("") is 0, so an empty box must be caught before parsing.
  if (low.trim() === "" || high.trim() === "") return { problem: "Fill in both numbers." };
  const parsed = TempRangeF.safeParse({ min: Number(low), max: Number(high) });
  if (parsed.success) return { range: parsed.data };
  const inBounds = [low, high].every((v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= TEMP_F_MIN && n <= TEMP_F_MAX;
  });
  return {
    problem: inBounds
      ? "Low should be at or below high."
      : `Use whole numbers from ${TEMP_F_MIN} to ${TEMP_F_MAX}.`,
  };
}
