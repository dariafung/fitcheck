// Replays the real transcript recorded by tests/record/transcribe.record.ts.
// No network and no cost; a miss means the audio or PROMPT_VERSION changed
// without a new recording.
import { describe, expect, it } from "vitest";
import { VOICE_CASE } from "@/tests/record/voice-cases";
import { transcribe } from "../index";

describe("transcribe recording", () => {
  it("hears an English note about a shirt", async () => {
    const out = await transcribe(VOICE_CASE.input, { mode: "replay" });
    expect(out.language).toBe("en");
    const text = out.text.toLowerCase();
    for (const word of ["color", "shirt", "soft", "tight", "shoulders", "work"]) {
      expect(text).toContain(word);
    }
  });
});
