import { describe, expect, it } from "vitest";
import { MAX_FEELING_LENGTH } from "./feeling-body";
import { appendTranscript, isTooLong } from "./feeling-draft";

describe("appendTranscript", () => {
  it("fills an empty box", () => {
    expect(appendTranscript("", " Love the color. ")).toBe("Love the color.");
    expect(appendTranscript("  \n", "Love the color.")).toBe("Love the color.");
  });

  it("adds a new line after existing text", () => {
    expect(appendTranscript("Tight at the waist.\n\n", "Love the color.")).toBe("Tight at the waist.\nLove the color.");
  });

  it("leaves the box alone when nothing was heard", () => {
    expect(appendTranscript("Tight at the waist. ", "  ")).toBe("Tight at the waist. ");
  });
});

describe("isTooLong", () => {
  it("counts the text as it will be saved", () => {
    expect(isTooLong("a".repeat(MAX_FEELING_LENGTH))).toBe(false);
    expect(isTooLong(` ${"a".repeat(MAX_FEELING_LENGTH)} `)).toBe(false);
    expect(isTooLong("a".repeat(MAX_FEELING_LENGTH + 1))).toBe(true);
  });
});
