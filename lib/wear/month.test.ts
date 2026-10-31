import { describe, expect, it } from "vitest";
import { monthLabel, monthRange, monthWeeks, parseMonth, shiftMonth } from "./month";

describe("month view", () => {
  it("accepts only YYYY-MM", () => {
    expect(parseMonth("2026-10")).toBe("2026-10");
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("2026-1")).toBeNull();
    expect(parseMonth(["2026-10"])).toBeNull();
  });

  it("steps across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthLabel("2026-10")).toBe("October 2026");
  });

  it("lays a month out in Sunday-first weeks with blanks around it", () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    const weeks = monthWeeks("2026-10");
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(weeks.at(-1)?.at(-1)).toBe("2026-10-31");
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it("knows where a month starts and ends", () => {
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});
