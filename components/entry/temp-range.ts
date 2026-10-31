import { DEFAULT_TEMP_UNIT, fromUnit, tempBounds, toUnit, type TempUnit } from "@/lib/profile/temp-unit";
import type { TempRangeF } from "@/lib/temperature";

// The two boxes (in the profile's unit) → a °F range, or a short note on
// what's wrong. Both empty is fine only when the model gave no range either.
// A box still showing the stored value keeps that exact °F, so opening and
// saving in °C never nudges it.
export function readTempRange(
  low: string,
  high: string,
  unit: TempUnit = DEFAULT_TEMP_UNIT,
  stored?: TempRangeF,
): { range?: TempRangeF; problem?: string } {
  if (low.trim() === "" && high.trim() === "") return {};
  // Number("") is 0, so an empty box must be caught before parsing.
  if (low.trim() === "" || high.trim() === "") return { problem: "Fill in both numbers." };
  const [lo, hi] = [Number(low), Number(high)];
  const bounds = tempBounds(unit);
  if (![lo, hi].every((n) => Number.isInteger(n) && n >= bounds.min && n <= bounds.max)) {
    return { problem: `Use whole numbers from ${bounds.min} to ${bounds.max}.` };
  }
  if (lo > hi) return { problem: "Low should be at or below high." };
  const kept = (n: number, f: number | undefined) => (f !== undefined && toUnit(f, unit) === n ? f : fromUnit(n, unit));
  const min = kept(lo, stored?.min);
  const max = kept(hi, stored?.max);
  // A kept low can sit just above a converted high that shows the same °C.
  return { range: { min: Math.min(min, max), max } };
}
