// Calendar days as "YYYY-MM-DD" strings, done in UTC so no time zone can
// shift them. No server-only imports: the calendar page bundles this file.
import { z } from "zod";

export const IsoDate = z.iso.date();

// How far back an outfit can still be logged, changed or deleted.
export const BACKFILL_DAYS = 30;
// Most outfits one day can hold.
export const MAX_OUTFITS_PER_DAY = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

// Whole days from a to b: positive when b is later.
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

// The local day on this device. In the browser that's the user's own day.
export function localDay(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// The day in Chicago, where the app counts its days (same as the AI budget).
export function chicagoDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
}

// Whether the browser may log on this day, judged by the browser's own today.
export function canLogOn(date: string, today: string): boolean {
  const back = daysBetween(date, today);
  return back >= 0 && back <= BACKFILL_DAYS;
}

// The server can't see the browser's day, so it allows every day some time
// zone could still be within the backfill window: up to a day either way.
export function serverAllowsDay(date: string, now = new Date()): boolean {
  const utcToday = now.toISOString().slice(0, 10);
  const back = daysBetween(date, utcToday);
  return back >= -1 && back <= BACKFILL_DAYS + 1;
}

const LONG = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// "Wed, Oct 21"
export function longDay(date: string): string {
  return LONG.format(new Date(toUtc(date)));
}

// "Oct 21"
export function shortDay(date: string): string {
  return SHORT.format(new Date(toUtc(date)));
}
