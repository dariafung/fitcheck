import { describe, expect, it } from "vitest";
import { needsSignIn } from "./proxy";

describe("needsSignIn", () => {
  it("guards app pages", () => {
    for (const path of ["/", "/closet", "/closet/add", "/closet/abc", "/profile", "/check"]) {
      expect(needsSignIn(path), path).toBe(true);
    }
  });

  it("leaves the sign-in pages and API routes open", () => {
    for (const path of ["/login", "/signup", "/api/items", "/api/cron/daily", "/api/health"]) {
      expect(needsSignIn(path), path).toBe(false);
    }
  });

  it("doesn't treat look-alike paths as public", () => {
    expect(needsSignIn("/loginx")).toBe(true);
    expect(needsSignIn("/apix")).toBe(true);
  });
});
