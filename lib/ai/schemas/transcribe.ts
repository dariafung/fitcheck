import { z } from "zod";
import { MediaRef } from "./common";

export const PROMPT_VERSION = "transcribe@1";

export const TranscribeInput = z.object({
  // 16 kHz WAV, converted in the browser.
  audio: MediaRef,
  language: z.enum(["auto", "en", "zh"]).default("auto"),
});
export type TranscribeInput = z.input<typeof TranscribeInput>;

export const TranscribeOutput = z.object({
  text: z.string(),
  language: z.string(),
});
export type TranscribeOutput = z.output<typeof TranscribeOutput>;
