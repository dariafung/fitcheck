import { describe, expect, it } from "vitest";
import { addDays, BACKFILL_DAYS, canLogOn, chicagoDay, daysBetween, longDay, serverAllowsDay } from "./day";

describe("calendar days", () => {
  it("adds days across months, years and leap days", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-10-01", "2026-10-31")).toBe(30);
    expect(daysBetween("2026-10-31", "2026-10-01")).toBe(-30);
  });

  it("counts days in Chicago, not UTC", () => {
    // 2:00 UTC on Oct 30 is still the evening of Oct 29 in Chicago.
    expect(chicagoDay(new Date("2026-10-30T02:00:00Z"))).toBe("2026-10-29");
  });

  it("lets the browser log today and the 30 days before, never the future", () => {
    const today = "2026-10-29";
    expect(canLogOn(today, today)).toBe(true);
    expect(canLogOn(addDays(today, -BACKFILL_DAYS), today)).toBe(true);
    expect(canLogOn(addDays(today, -BACKFILL_DAYS - 1), today)).toBe(false);
    expect(canLogOn(addDays(today, 1), today)).toBe(false);
  });

  it("gives every time zone a day either way on the server", () => {
    const now = new Date("2026-10-29T12:00:00Z");
    expect(serverAllowsDay("2026-10-30", now)).toBe(true);
    expect(serverAllowsDay("2026-10-31", now)).toBe(false);
    expect(serverAllowsDay(addDays("2026-10-29", -BACKFILL_DAYS - 1), now)).toBe(true);
    expect(serverAllowsDay(addDays("2026-10-29", -BACKFILL_DAYS - 2), now)).toBe(false);
  });

  it("names a day the way the panel shows it", () => {
    expect(longDay("2026-10-21")).toBe("Wed, Oct 21");
  });
});
