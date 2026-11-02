import { describe, expect, it } from "vitest";
import { DEMO_EMAIL } from "./config";
import { needsSignIn, sendsSignedInHome } from "./proxy";

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

describe("sendsSignedInHome", () => {
  it("sends a signed-in visitor away from the login pages only", () => {
    for (const path of ["/login", "/signup"]) expect(sendsSignedInHome(path), path).toBe(true);
    for (const path of ["/", "/closet", "/profile", "/loginx", "/api/items"]) expect(sendsSignedInHome(path), path).toBe(false);
  });

  it("lets the demo account reach /signup but not /login", () => {
    expect(sendsSignedInHome("/signup", DEMO_EMAIL)).toBe(false);
    expect(sendsSignedInHome("/login", DEMO_EMAIL)).toBe(true);
    expect(sendsSignedInHome("/signup", "someone@example.com")).toBe(true);
  });
});
