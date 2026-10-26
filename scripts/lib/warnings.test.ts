import { describe, expect, it } from "vitest";
import { unexpectedBuildWarnings } from "./warnings.mjs";

describe("unexpectedBuildWarnings", () => {
  it("finds warning lines, including colored ones", () => {
    const output = [
      "\x1b[32m✓\x1b[39m Compiled successfully",
      "\x1b[33m⚠\x1b[39m Something looks off",
      " warn  - deprecated option",
      "Route (app)",
    ].join("\n");
    expect(unexpectedBuildWarnings(output)).toEqual([
      "⚠ Something looks off",
      "warn  - deprecated option",
    ]);
  });
});
