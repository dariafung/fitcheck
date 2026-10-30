// The calendar's month view: "YYYY-MM" months laid out in weeks, Sunday
// first. No server-only imports: the calendar page bundles this file.
import { addDays } from "./day";

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parseMonth(value: unknown): string | null {
  return typeof value === "string" && MONTH.test(value) ? value : null;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function shiftMonth(month: string, by: number): string {
  const [year, m] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

const LABEL = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

// "October 2026"
export function monthLabel(month: string): string {
  return LABEL.format(new Date(`${month}-01T00:00:00Z`));
}

// The month's weeks, Sunday to Saturday. Days from the months either side
// are null, so the grid only shows this month's dates.
export function monthWeeks(month: string): (string | null)[][] {
  const first = `${month}-01`;
  const start = addDays(first, -new Date(`${first}T00:00:00Z`).getUTCDay());
  const weeks: (string | null)[][] = [];
  for (let day = start; monthOf(day) <= month; ) {
    const week: (string | null)[] = [];
    for (let i = 0; i < 7; i++, day = addDays(day, 1)) week.push(monthOf(day) === month ? day : null);
    weeks.push(week);
  }
  return weeks;
}

// First and last day of the month.
export function monthRange(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: addDays(`${shiftMonth(month, 1)}-01`, -1) };
}
