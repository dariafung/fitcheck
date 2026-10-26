import { describe, expect, it } from "vitest";
import { inputHash, stableStringify } from "./hash";

describe("stableStringify", () => {
  it("ignores key order and undefined fields", () => {
    expect(stableStringify({ b: 1, a: { d: [2, 3], c: undefined } })).toBe(
      stableStringify({ a: { d: [2, 3] }, b: 1 }),
    );
  });
});

describe("inputHash", () => {
  it("changes with the prompt version", () => {
    expect(inputHash("fn", "v1", { x: 1 })).not.toBe(inputHash("fn", "v2", { x: 1 }));
  });

  it("hashes inline media by content", () => {
    const a = { image: { kind: "inline", mime: "image/png", base64: "AAAA" } };
    const b = { image: { kind: "inline", mime: "image/png", base64: "BBBB" } };
    expect(inputHash("fn", "v1", a)).toBe(inputHash("fn", "v1", structuredClone(a)));
    expect(inputHash("fn", "v1", a)).not.toBe(inputHash("fn", "v1", b));
  });
});
