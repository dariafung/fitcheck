import { cookieString } from "../cookie";

// Display units for the profile page, kept in the browser. The database
// always holds cm / kg.
export type Units = "imperial" | "metric";
export const UNITS_COOKIE = "fc_units";
export const DEFAULT_UNITS: Units = "imperial";

export const CM_PER_IN = 2.54;
export const KG_PER_LB = 0.45359237;

export function parseUnits(raw: string | null | undefined): Units {
  return raw === "metric" ? "metric" : DEFAULT_UNITS;
}

export function unitsCookieString(units: Units): string {
  return cookieString(UNITS_COOKIE, units);
}

export function unitLabel(kind: "length" | "weight", units: Units): string {
  if (kind === "length") return units === "imperial" ? "in" : "cm";
  return units === "imperial" ? "lb" : "kg";
}

// Rounds to 1 / perUnit steps (2 → halves, 10 → tenths) without float dust.
const roundTo = (n: number, perUnit: number) => Math.round(n * perUnit) / perUnit;

// Shown values: inches to 0.5, pounds to 1, cm / kg to 0.1.
export function toDisplay(kind: "length" | "weight", metric: number, units: Units): number {
  if (units === "metric") return roundTo(metric, 10);
  return kind === "length" ? roundTo(metric / CM_PER_IN, 2) : Math.round(metric / KG_PER_LB);
}

export function fromDisplay(kind: "length" | "weight", shown: number, units: Units): number {
  if (units === "metric") return shown;
  return kind === "length" ? shown * CM_PER_IN : shown * KG_PER_LB;
}

// A metric range as shown, rounded inward so both ends convert back inside it.
export function displayBounds(
  kind: "length" | "weight",
  { min, max }: { min: number; max: number },
  units: Units,
): { min: number; max: number } {
  const perUnit = units === "metric" ? 10 : kind === "length" ? 2 : 1;
  const shown = (n: number) => (units === "metric" ? n : kind === "length" ? n / CM_PER_IN : n / KG_PER_LB);
  return {
    min: Math.ceil(shown(min) * perUnit - 1e-9) / perUnit,
    max: Math.floor(shown(max) * perUnit + 1e-9) / perUnit,
  };
}

// 65 in → "5 ft 5 in", a hint next to the height field.
export function feetAndInches(inches: number): string {
  const whole = Math.round(inches);
  return `${Math.floor(whole / 12)} ft ${whole % 12} in`;
}
