import { describe, expect, it } from "vitest";
import { closetTab, inTab } from "./tabs";

describe("closetTab", () => {
  it("reads the tab param and falls back to All", () => {
    expect(closetTab("passing-on")).toBe("passing-on");
    expect(closetTab("all")).toBe("all");
    expect(closetTab(undefined)).toBe("all");
    expect(closetTab("nope")).toBe("all");
    expect(closetTab(["passing-on", "all"])).toBe("all");
  });
});

describe("inTab", () => {
  const items = [
    { id: "tee", status: "active" },
    { id: "shorts", status: "passing_on" },
    { id: "jeans", status: "active" },
  ];

  it("splits by status and keeps order", () => {
    expect(inTab(items, "all").map((i) => i.id)).toEqual(["tee", "jeans"]);
    expect(inTab(items, "passing-on").map((i) => i.id)).toEqual(["shorts"]);
  });
});
