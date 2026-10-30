import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryBudgetStore, PRICE_PER_IMAGE, setBudgetStore, spentTodayUsd } from "../budget";
import { AiNotConfiguredError, AiOutputError, AiUpstreamError } from "../errors";
import { segmentGarment } from "../index";
import { IMAGE_MODEL, imageEditsUrl, REASONING_STRENGTH } from "./segment-garment";

const key = vi.hoisted(() => ({ value: "test-key" as string | null }));
vi.mock("./key", () => ({ getMetaApiKey: async () => key.value }));

const fetchMock = vi.fn<typeof fetch>();
const LIVE = { mode: "live", record: false } as const;
const PHOTO = { kind: "inline", mime: "image/png", base64: Buffer.from("png-bytes").toString("base64") } as const;
const INPUT = { image: PHOTO, category: "top", description: "Blue floral corset top" };

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const IMAGES = { created: 1, data: [{ b64_json: "Y3V0b3V0" }], output_format: "png" };

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
async function run(input: Parameters<typeof segmentGarment>[0] = INPUT) {
  const result = segmentGarment(input, LIVE);
  // The caller asserts on the rejection; keep it from counting as unhandled meanwhile.
  result.catch(() => {});
  await vi.runAllTimersAsync();
  return result;
}

describe("live segmentGarment", () => {
  it("sends one photo to Muse Image with every search tool off", async () => {
    fetchMock.mockResolvedValueOnce(answer(IMAGES));
    await run();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(imageEditsUrl());
    expect(url).toBe("https://api.meta.ai/v1/images/edits");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key", "Content-Type": "application/json" });
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({
      model: IMAGE_MODEL,
      images: [{ image_url: `data:image/png;base64,${PHOTO.base64}` }],
      n: 1,
      output_format: "png",
      response_format: "b64_json",
      reasoning_strength: REASONING_STRENGTH,
      tool_enablement: { enable_web_search: false, enable_image_search: false, enable_shell: false },
    });
    expect(body.prompt).toContain("top (Blue floral corset top)");
    expect(body.prompt).toContain("pure white background");
    expect(body.prompt).toContain("Remove every person");
  });

  it("passes a URL image as it is", async () => {
    fetchMock.mockResolvedValueOnce(answer(IMAGES));
    await run({ image: { kind: "url", url: "https://example.com/a.png" }, category: "shoes" });
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.images).toEqual([{ image_url: "https://example.com/a.png" }]);
  });

  it("returns the image and counts one picture's price", async () => {
    fetchMock.mockResolvedValueOnce(answer(IMAGES));
    expect(await run()).toEqual({ image: { mime: "image/png", base64: "Y3V0b3V0" } });
    expect(await spentTodayUsd()).toBeCloseTo(PRICE_PER_IMAGE, 12);
  });

  it("retries once after a 429, a 5xx or a network error", async () => {
    fetchMock.mockResolvedValueOnce(answer({}, 503)).mockResolvedValueOnce(answer(IMAGES));
    expect((await run()).image.base64).toBe("Y3V0b3V0");
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(answer(IMAGES));
    expect((await run()).image.base64).toBe("Y3V0b3V0");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("fails as upstream when the retry fails too", async () => {
    fetchMock.mockResolvedValue(answer({}, 500));
    await expect(run()).rejects.toBeInstanceOf(AiUpstreamError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a refusal", async () => {
    fetchMock.mockResolvedValueOnce(answer({ error: { code: "content_policy_violation" } }, 400));
    await expect(run()).rejects.toBeInstanceOf(AiUpstreamError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await spentTodayUsd()).toBe(0);
  });

  it("asks again once when the answer has no image", async () => {
    fetchMock.mockResolvedValue(answer({ created: 1, data: [] }));
    await expect(run()).rejects.toBeInstanceOf(AiOutputError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("needs a key and an inline or URL image", async () => {
    key.value = null;
    await expect(run()).rejects.toBeInstanceOf(AiNotConfiguredError);
    key.value = "test-key";
    await expect(run({ image: { kind: "storage", path: "a/b.png" }, category: "top" })).rejects.toBeInstanceOf(
      AiNotConfiguredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
