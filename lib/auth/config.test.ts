import { afterEach, describe, expect, it, vi } from "vitest";
import { demoLocked } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("demoLocked", () => {
  it("keeps the demo account read-only unless DEMO_WRITABLE=1", () => {
    expect(demoLocked()).toBe(true);
    vi.stubEnv("DEMO_WRITABLE", "0");
    expect(demoLocked()).toBe(true);
    vi.stubEnv("DEMO_WRITABLE", "1");
    expect(demoLocked()).toBe(false);
  });
});
