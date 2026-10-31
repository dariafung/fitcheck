import { z } from "zod";
import { TEMP_F_MAX, TEMP_F_MIN } from "../temperature";

// The unit temperatures are shown and typed in, saved with the profile.
// Stored temperatures stay whole °F; °C is only for the page. An account
// that hasn't picked yet sees °F.
export const TempUnit = z.enum(["F", "C"]);
export type TempUnit = z.infer<typeof TempUnit>;
export const DEFAULT_TEMP_UNIT: TempUnit = "F";

export function parseTempUnit(raw: unknown): TempUnit {
  return TempUnit.safeParse(raw).data ?? DEFAULT_TEMP_UNIT;
}

// Whole °F → the whole number shown.
export function toUnit(f: number, unit: TempUnit): number {
  return unit === "F" ? f : Math.round(((f - 32) * 5) / 9);
}

// A typed whole number → whole °F. Every °C in tempBounds("C") comes back
// unchanged through toUnit.
export function fromUnit(n: number, unit: TempUnit): number {
  return unit === "F" ? n : Math.round((n * 9) / 5 + 32);
}

// What may be typed: whole numbers that land in TEMP_F_MIN..TEMP_F_MAX.
export function tempBounds(unit: TempUnit): { min: number; max: number } {
  return { min: toUnit(TEMP_F_MIN, unit), max: toUnit(TEMP_F_MAX, unit) };
}
