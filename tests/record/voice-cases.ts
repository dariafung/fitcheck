// Recording input for transcribe, kept apart from cases.ts. The audio is a
// synthetic English voice (macOS `say`, Samantha) saying:
// "I love the color of this shirt and it feels soft, but it is a little tight
// across the shoulders, so I mostly wear it to work."
// converted to 16 kHz mono 16-bit WAV, the format the browser uploads.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { TranscribeInput } from "@/lib/ai/schemas/transcribe";

export const VOICE_FIXTURE = path.join(process.cwd(), "fixtures", "audio", "feeling-en.wav");

export const VOICE_CASE: { name: string; input: TranscribeInput } = {
  name: "shirt, soft but tight in the shoulders",
  input: {
    audio: { kind: "inline", mime: "audio/wav", base64: readFileSync(VOICE_FIXTURE).toString("base64") },
    language: "en",
  },
};
