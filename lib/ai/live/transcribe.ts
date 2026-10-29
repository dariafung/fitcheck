import { z } from "zod";
import { audioCostUsd, recordSpend } from "../budget";
import { AiNotConfiguredError, AiUpstreamError } from "../errors";
import type { TranscribeInput, TranscribeOutput } from "../schemas/transcribe";
import { META_API_BASE_URL } from "./client";
import { getMetaApiKey } from "./key";

export const TRANSCRIBE_MODEL = "muse-voice-transcribe-1.0";

// Four tries at most (runAi retries a bad answer once) still fit in the
// 300-second function limit.
const TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 1000;

// The buffered JSON answer (dev.meta.ai/docs/api-reference/voice/schemas).
// It has no detected language.
const TranscribeResponse = z.object({
  transcript: z.string(),
  audioDurationMs: z.number().nonnegative(),
});

export function transcribeUrl(): string {
  return `${META_API_BASE_URL}/asr/transcribe`;
}

// English only for now: the language is always biased to English and the
// answer always says "en", whatever the input asks for.
export function transcribeRequest(): Record<string, unknown> {
  return {
    model: TRANSCRIBE_MODEL,
    audioEncoding: "WAV",
    mode: "PUSH_TO_TALK",
    languageBias: ["English"],
  };
}

// One file transcription (POST /asr/transcribe, multipart). Not part of the
// Responses API, so it uses fetch instead of the openai client. A 429, a 5xx
// or a network error is retried once, like the SDK does for the other calls.
export async function liveTranscribe(
  input: z.output<typeof TranscribeInput>,
): Promise<z.input<typeof TranscribeOutput> | null> {
  if (input.audio.kind !== "inline") {
    throw new AiNotConfiguredError("transcribe", "live mode takes inline audio only");
  }
  const apiKey = await getMetaApiKey();
  if (!apiKey) throw new AiNotConfiguredError("transcribe", "no Meta API key found");

  const audio = Uint8Array.from(Buffer.from(input.audio.base64, "base64"));
  const send = () => {
    const form = new FormData();
    form.append("request", new Blob([JSON.stringify(transcribeRequest())], { type: "application/json" }));
    form.append("audio", new Blob([audio], { type: "audio/wav" }), "recording.wav");
    return fetch(transcribeUrl(), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  };

  let res = await send().catch(() => null);
  if (!res || res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    res = await send().catch(() => null);
  }
  if (!res?.ok) throw new AiUpstreamError("transcribe", res?.status);

  const parsed = TranscribeResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return null;
  await recordSpend(audioCostUsd(parsed.data.audioDurationMs));
  return { text: parsed.data.transcript.trim(), language: "en" };
}
