import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { audioCostUsd, memoryBudgetStore, setBudgetStore, spentTodayUsd } from "../budget";
import { AiNotConfiguredError, AiOutputError, AiUpstreamError } from "../errors";
import { transcribe } from "../index";
import { TRANSCRIBE_MODEL, transcribeUrl } from "./transcribe";

const key = vi.hoisted(() => ({ value: "test-key" as string | null }));
vi.mock("./key", () => ({ getMetaApiKey: async () => key.value }));

const fetchMock = vi.fn<typeof fetch>();
const LIVE = { mode: "live", record: false } as const;
const AUDIO = { kind: "inline", mime: "audio/wav", base64: Buffer.from("RIFF-test-audio").toString("base64") } as const;

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const TRANSCRIPT = { sessionId: "s1", transcript: " Love the color, tight at the waist. ", audioDurationMs: 7900, turns: [] };

beforeEach(() => {
  key.value = "test-key";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  setBudgetStore(memoryBudgetStore());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// Runs the call while letting the retry delay pass.
async function run(input: Parameters<typeof transcribe>[0] = { audio: AUDIO }) {
  const result = transcribe(input, LIVE);
  // The caller asserts on the rejection; keep it from counting as unhandled meanwhile.
  result.catch(() => {});
  await vi.runAllTimersAsync();
  return result;
}

describe("live transcribe", () => {
  it("sends the WAV and an English-only request as multipart", async () => {
    fetchMock.mockResolvedValueOnce(answer(TRANSCRIPT));
    await run({ audio: AUDIO, language: "auto" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(transcribeUrl());
    expect(url).toBe("https://api.meta.ai/v1/asr/transcribe");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key", Accept: "application/json" });
    const form = init?.body as FormData;
    expect(JSON.parse(await (form.get("request") as Blob).text())).toEqual({
      model: TRANSCRIBE_MODEL,
      audioEncoding: "WAV",
      mode: "PUSH_TO_TALK",
      languageBias: ["English"],
    });
    const audio = form.get("audio") as File;
    expect(audio.type).toBe("audio/wav");
    expect(await audio.text()).toBe("RIFF-test-audio");
  });

  it("returns the trimmed transcript, always in English", async () => {
    fetchMock.mockResolvedValueOnce(answer(TRANSCRIPT));
    expect(await run()).toEqual({ text: "Love the color, tight at the waist.", language: "en" });
  });

  it("counts the cost by whole seconds of audio", async () => {
    fetchMock.mockResolvedValueOnce(answer(TRANSCRIPT));
    await run();
    expect(await spentTodayUsd()).toBeCloseTo(audioCostUsd(7900), 12);
    expect(audioCostUsd(7900)).toBeCloseTo((7 * 0.18) / 3600, 12);
    expect(audioCostUsd(180_000)).toBeCloseTo(0.009, 12);
  });

  it("retries once after a 429 or 5xx", async () => {
    fetchMock.mockResolvedValueOnce(answer({}, 429)).mockResolvedValueOnce(answer(TRANSCRIPT));
    expect((await run()).text).toBe("Love the color, tight at the waist.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries once after a network error", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(answer(TRANSCRIPT));
    expect((await run()).text).toBe("Love the color, tight at the waist.");
  });

  it("fails as upstream when the retry fails too", async () => {
    fetchMock.mockResolvedValue(answer({}, 500));
    await expect(run()).rejects.toBeInstanceOf(AiUpstreamError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 400", async () => {
    fetchMock.mockResolvedValueOnce(answer({ error: { type: "invalid_request" } }, 400));
    await expect(run()).rejects.toBeInstanceOf(AiUpstreamError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks again once when the answer has no transcript", async () => {
    fetchMock.mockResolvedValue(answer({ sessionId: "s1" }));
    await expect(run()).rejects.toBeInstanceOf(AiOutputError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("needs a key and inline audio", async () => {
    key.value = null;
    await expect(run()).rejects.toBeInstanceOf(AiNotConfiguredError);
    key.value = "test-key";
    await expect(run({ audio: { kind: "storage", path: "a/b.wav" } })).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
