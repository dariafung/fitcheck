import { describe, expect, it } from "vitest";
import { AI_WAITS, waitProgress, waitText, type AiWaitName } from "./ai-wait";

describe("waitText", () => {
  it("moves through the steps with time and stays on the last", () => {
    expect(waitText("read", 0)).toBe("Reading your screenshot…");
    expect(waitText("read", 6)).toBe("Looking up the material and fit online…");
    expect(waitText("read", 500)).toBe("Taking longer than usual, still working…");
  });

  it("starts every wait at 0 s, with steps in order", () => {
    for (const name of Object.keys(AI_WAITS) as AiWaitName[]) {
      const ats = AI_WAITS[name].steps.map((s) => s.at);
      expect(ats[0]).toBe(0);
      expect([...ats].sort((a, b) => a - b)).toEqual(ats);
    }
  });
});

describe("waitProgress", () => {
  it("starts empty, is well along at the usual time, and never finishes by itself", () => {
    expect(waitProgress(0, 20)).toBe(0);
    expect(waitProgress(20, 20)).toBeGreaterThan(0.8);
    expect(waitProgress(20, 20)).toBeLessThan(0.9);
    expect(waitProgress(600, 20)).toBeLessThan(1);
    expect(waitProgress(40, 20)).toBeGreaterThan(waitProgress(20, 20));
  });
});
