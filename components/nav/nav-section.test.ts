import { describe, expect, it } from "vitest";
import { navSection } from "./nav-section";

describe("navSection", () => {
  it("lights up home only on /", () => {
    expect(navSection("/")).toBe("/");
  });

  it("counts sub-pages as their parent", () => {
    expect(navSection("/closet")).toBe("/closet");
    expect(navSection("/closet/add")).toBe("/closet");
    expect(navSection("/closet/3f1c2a")).toBe("/closet");
    expect(navSection("/calendar")).toBe("/calendar");
    expect(navSection("/suits-you")).toBe("/suits-you");
    expect(navSection("/calendar/2026-10-31")).toBe("/calendar");
    expect(navSection("/profile")).toBe("/profile");
    expect(navSection("/profile/anything")).toBe("/profile");
  });

  it("lights up nothing on the purchase check or the login pages", () => {
    for (const path of ["/check", "/login", "/signup"]) expect(navSection(path)).toBeNull();
  });

  it("matches whole segments only", () => {
    expect(navSection("/closets")).toBeNull();
    expect(navSection("/profiles/x")).toBeNull();
  });
});
