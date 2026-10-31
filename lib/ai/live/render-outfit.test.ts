import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryBudgetStore, PRICE_PER_IMAGE, setBudgetStore, spentTodayUsd } from "../budget";
import { AiNotConfiguredError, AiOutputError, AiUpstreamError } from "../errors";
import { renderOutfit } from "../index";
import { RenderOutfitInput } from "../schemas/render-outfit";
import { BOARD_REASONING_STRENGTH, BOARD_RULES, placement, responsesUrl } from "./render-outfit";
import { IMAGE_MODEL } from "./segment-garment";

const key = vi.hoisted(() => ({ value: "test-key" as string | null }));
vi.mock("./key", () => ({ getMetaApiKey: async () => key.value }));

const fetchMock = vi.fn<typeof fetch>();
const LIVE = { mode: "live", record: false } as const;
const photo = (bytes: string) => ({ kind: "inline", mime: "image/png", base64: Buffer.from(bytes).toString("base64") }) as const;
const piece = (n: number, category: "top" | "bottom" | "shoes" | "one_piece" | "outerwear", description: string) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  image: photo(`${category}-png`),
  category,
  description,
});
const INPUT = {
  items: [
    piece(1, "top", "Turtleneck: top; colors burgundy"),
    piece(2, "bottom", "Cargo short: bottom; colors slate"),
    piece(3, "shoes", "Tree Runner: shoes; colors black"),
  ],
};

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const BOARD = {
  output: [
    { type: "reasoning", summary: [] },
    { type: "image_generation_call", status: "completed", result: "Ym9hcmQ=" },
    { type: "message", content: [] },
  ],
};

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
async function run(input: Parameters<typeof renderOutfit>[0] = INPUT) {
  const result = renderOutfit(input, LIVE);
  // The caller asserts on the rejection; keep it from counting as unhandled meanwhile.
  result.catch(() => {});
  await vi.runAllTimersAsync();
  return result;
}

describe("RenderOutfitInput", () => {
  it("takes one outfit of 2 to 4 pieces", () => {
    const four = [...INPUT.items, piece(4, "outerwear", "Coat")];
    expect(RenderOutfitInput.safeParse({ items: INPUT.items.slice(1) }).success).toBe(true);
    expect(RenderOutfitInput.safeParse({ items: four }).success).toBe(true);
    expect(RenderOutfitInput.safeParse({ items: INPUT.items.slice(2) }).success).toBe(false);
    expect(RenderOutfitInput.safeParse({ items: [...four, piece(5, "top", "Tee")] }).success).toBe(false);
  });
});

describe("live renderOutfit", () => {
  it("sends each photo after a line naming it, with every search tool off and no size", async () => {
    fetchMock.mockResolvedValueOnce(answer(BOARD));
    await run();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(responsesUrl());
    expect(url).toBe("https://api.meta.ai/v1/responses");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key", "Content-Type": "application/json" });
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({ model: IMAGE_MODEL, store: false });
    expect(body.tools).toEqual([
      {
        type: "image_generation",
        enable_web_search: false,
        enable_image_search: false,
        enable_shell: false,
        reasoning_strength: BOARD_REASONING_STRENGTH,
        output_format: "png",
      },
    ]);

    const content = body.input[0].content;
    expect(content.map((c: { type: string }) => c.type)).toEqual([
      "input_text",
      "input_text",
      "input_image",
      "input_text",
      "input_image",
      "input_text",
      "input_image",
      "input_text",
    ]);
    expect(content[0].text).toContain("exactly these 3 clothing items");
    expect(content[1].text).toBe("Item 1, the top: Turtleneck: top; colors burgundy. Place it upper left.");
    expect(content[2].image_url).toBe(`data:image/png;base64,${INPUT.items[0].image.base64}`);
    expect(content[3].text).toBe("Item 2, the bottom: Cargo short: bottom; colors slate. Place it middle right.");
    expect(content[5].text).toBe("Item 3, the shoes: Tree Runner: shoes; colors black. Place it lower left.");
    expect(content[7].text).toBe(BOARD_RULES);
  });

  it("places a one-piece and a layer like the real board does", async () => {
    fetchMock.mockResolvedValueOnce(answer(BOARD));
    await run({ items: [piece(1, "one_piece", "Dress"), piece(2, "outerwear", "Coat"), piece(3, "shoes", "Boots")] });
    const content = JSON.parse(fetchMock.mock.calls[0][1]?.body as string).input[0].content;
    expect(content[1].text).toMatch(/the one-piece: Dress\. Place it middle right\.$/);
    expect(content[3].text).toMatch(/the outer layer: Coat\. Place it upper left\.$/);
    expect(content[5].text).toMatch(/the shoes: Boots\. Place it lower left\.$/);
  });

  it("names a box's place on the board", () => {
    expect(placement({ left: 4, top: 4, width: 46, height: 46 })).toBe("upper left");
    expect(placement({ left: 30, top: 30, width: 40, height: 40 })).toBe("in the center");
    expect(placement({ left: 52, top: 60, width: 44, height: 36 })).toBe("lower right");
  });

  it("returns the board and the prompt, and counts one picture's price", async () => {
    fetchMock.mockResolvedValueOnce(answer(BOARD));
    const result = await run();
    expect(result.image).toEqual({ mime: "image/png", base64: "Ym9hcmQ=" });
    expect(result.prompt).toContain("Place it lower left.");
    expect(result.prompt).toContain(BOARD_RULES);
    expect(await spentTodayUsd()).toBeCloseTo(PRICE_PER_IMAGE, 12);
  });

  it("passes a URL photo as it is", async () => {
    fetchMock.mockResolvedValueOnce(answer(BOARD));
    await run({ items: [{ ...INPUT.items[0], image: { kind: "url", url: "https://example.com/a.png" } }, INPUT.items[2]] });
    const content = JSON.parse(fetchMock.mock.calls[0][1]?.body as string).input[0].content;
    expect(content[2].image_url).toBe("https://example.com/a.png");
  });

  it("retries once after a 429, a 5xx or a network error", async () => {
    fetchMock.mockResolvedValueOnce(answer({}, 503)).mockResolvedValueOnce(answer(BOARD));
    expect((await run()).image.base64).toBe("Ym9hcmQ=");
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(answer(BOARD));
    expect((await run()).image.base64).toBe("Ym9hcmQ=");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("fails as upstream when the retry fails too", async () => {
    fetchMock.mockResolvedValue(answer({}, 500));
    await expect(run()).rejects.toBeInstanceOf(AiUpstreamError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a refusal, and it costs nothing", async () => {
    fetchMock.mockResolvedValueOnce(answer({ error: { code: "content_policy_violation" } }, 400));
    await expect(run()).rejects.toBeInstanceOf(AiUpstreamError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await spentTodayUsd()).toBe(0);
  });

  it("doesn't ask again when the answer has no picture", async () => {
    fetchMock.mockResolvedValue(answer({ output: [{ type: "message", content: [] }] }));
    await expect(run()).rejects.toBeInstanceOf(AiOutputError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await spentTodayUsd()).toBe(0);
  });

  it("needs a key and inline or URL photos", async () => {
    key.value = null;
    await expect(run()).rejects.toBeInstanceOf(AiNotConfiguredError);
    key.value = "test-key";
    const stored = { ...INPUT.items[0], image: { kind: "storage", path: "a/b.png" } } as const;
    await expect(run({ items: [stored, INPUT.items[2]] })).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
