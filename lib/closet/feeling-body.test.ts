import { describe, expect, it } from "vitest";
import { ParseFeelingInput } from "@/lib/ai/schemas/parse-feeling";
import { FeelingBody, MAX_FEELING_LENGTH } from "./feeling-body";

describe("FeelingBody", () => {
  it("trims the text and rejects blanks", () => {
    expect(FeelingBody.parse({ text: "  comfy  " })).toEqual({ text: "comfy", source: "typed" });
    expect(FeelingBody.safeParse({ text: "   " }).success).toBe(false);
    expect(FeelingBody.safeParse({}).success).toBe(false);
  });

  it("takes typed or voice as the source", () => {
    expect(FeelingBody.parse({ text: "comfy", source: "voice" }).source).toBe("voice");
    expect(FeelingBody.safeParse({ text: "comfy", source: "video" }).success).toBe(false);
  });

  it("caps length like the parseFeeling input", () => {
    expect(ParseFeelingInput.shape.text.maxLength).toBe(MAX_FEELING_LENGTH);
    expect(FeelingBody.safeParse({ text: "a".repeat(MAX_FEELING_LENGTH + 1) }).success).toBe(false);
  });
});
