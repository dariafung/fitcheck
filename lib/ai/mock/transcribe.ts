import type { z } from "zod";
import type { TranscribeInput, TranscribeOutput } from "../schemas/transcribe";

export function mockTranscribe(
  input: z.output<typeof TranscribeInput>,
): z.input<typeof TranscribeOutput> {
  return {
    text: "Mock transcript: this fits well and I wear it a lot.",
    language: input.language === "auto" ? "en" : input.language,
  };
}
