import OpenAI from "openai";
import type { Response } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetBudget, spentTodayUsd } from "../budget";
import { AiNotConfiguredError, AiOutputError, AiUpstreamError } from "../errors";
import { extractItem, judgePairing, parseFeeling } from "../index";
import { MODEL } from "./respond";

const create = vi.fn();
vi.mock("./client", () => ({ getClient: async () => ({ responses: { create } }) }));

const LIVE = { mode: "live", record: false } as const;
const USAGE = {
  input_tokens: 1000,
  input_tokens_details: { cached_tokens: 0 },
  output_tokens: 1000,
  output_tokens_details: { reasoning_tokens: 400 },
  total_tokens: 2000,
};

function reply(json: unknown, extra: { status?: string; output?: unknown[] } = {}): Response {
  const { output = [], ...rest } = extra;
  return {
    id: "resp_1",
    status: "completed",
    usage: USAGE,
    ...rest,
    output: [
      ...output,
      {
        type: "message",
        id: "msg_1",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: JSON.stringify(json), annotations: [] }],
      },
    ],
  } as unknown as Response;
}

const item = (id: string, title: string, category: "top" | "bottom" | "shoes") => ({
  id,
  title,
  tags: { category, colors: [{ name: "white" }], materials: ["cotton"], formality: 3, occasions: ["work" as const] },
});
const SHIRT = item("852c8e3d-abf7-4955-ab65-9d83194a02ae", "White shirt", "top");
const JEANS = item("c81b2b56-1f62-4284-83b6-7307a6355ac5", "Jeans", "bottom");
const SHOES = item("23c59091-9b18-4c24-92c3-1072a5581d8e", "Sneakers", "shoes");

const FEELING = {
  flattering: "unknown",
  liked: "yes",
  bodyAreas: [{ area: "shoulders", sentiment: "negative" }],
  occasions: ["work"],
  mood: ["calm"],
  summary: "Comfortable but tight in the shoulders.",
};

beforeEach(() => {
  create.mockReset();
  resetBudget();
});

describe("shared request", () => {
  it("asks muse-spark-1.3 for strict JSON, unstored, with low reasoning", async () => {
    create.mockResolvedValue(reply(FEELING));
    await expect(parseFeeling({ text: "Comfy, tight shoulders", item: SHIRT }, LIVE)).resolves.toEqual(FEELING);
    const [body, options] = create.mock.calls[0];
    expect(body).toMatchObject({
      model: MODEL,
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 3000,
      text: { format: { type: "json_schema", name: "feeling", strict: true } },
    });
    expect(body.tools).toBeUndefined();
    expect(body.input[0].content[0].text).toContain("<note>\nComfy, tight shoulders\n</note>");
    expect(options).toEqual({ timeout: 60_000, maxRetries: 1 });
  });

  it("records what the call cost", async () => {
    create.mockResolvedValue(reply(FEELING));
    await parseFeeling({ text: "Fine", item: SHIRT }, LIVE);
    // 1000 input at $1.25/M + 1000 output at $4.25/M
    expect(spentTodayUsd()).toBeCloseTo(0.0055, 6);
  });

  it("retries once when the answer is cut off, then gives up", async () => {
    create.mockResolvedValue(reply(FEELING, { status: "incomplete" }));
    await expect(parseFeeling({ text: "Fine", item: SHIRT }, LIVE)).rejects.toBeInstanceOf(AiOutputError);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("retries once when the text is not the expected JSON", async () => {
    create.mockResolvedValueOnce(reply({ nope: true })).mockResolvedValueOnce(reply(FEELING));
    await expect(parseFeeling({ text: "Fine", item: SHIRT }, LIVE)).resolves.toEqual(FEELING);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("wraps API failures", async () => {
    create.mockRejectedValue(new OpenAI.APIError(503, undefined, "overloaded", new Headers()));
    await expect(parseFeeling({ text: "Fine", item: SHIRT }, LIVE)).rejects.toBeInstanceOf(AiUpstreamError);
  });
});

describe("judgePairing", () => {
  const pairs = [
    { a: SHIRT, b: JEANS },
    { a: SHIRT, b: SHOES },
    { a: JEANS, b: SHOES },
  ];

  it("lists each item once and refers to pairs by number", async () => {
    create.mockResolvedValue(reply({ results: [] }));
    await judgePairing({ pairs }, LIVE);
    const text: string = create.mock.calls[0][0].input[0].content[0].text;
    expect(text.match(/White shirt/g)).toHaveLength(1);
    expect(text).toContain("P1: I1 + I2\nP2: I1 + I3\nP3: I2 + I3");
  });

  it("maps numbers back to ids and drops repeats and unknown numbers", async () => {
    create.mockResolvedValue(
      reply({
        results: [
          { pair: 2, pairs: false, reason: "b" },
          { pair: 1, pairs: true, reason: "a" },
          { pair: 2, pairs: true, reason: "again" },
          { pair: 9, pairs: true, reason: "made up" },
        ],
      }),
    );
    await expect(judgePairing({ pairs }, LIVE)).resolves.toEqual({
      results: [
        { aId: SHIRT.id, bId: SHOES.id, pairs: false, reason: "b" },
        { aId: SHIRT.id, bId: JEANS.id, pairs: true, reason: "a" },
      ],
    });
  });
});

describe("extractItem", () => {
  const SCREENSHOT = { kind: "inline" as const, mime: "image/jpeg", base64: "AAAA" };
  const WIRE = {
    recognized: true,
    title: "Linen shirt",
    brand: "Acme",
    price: 49.9,
    currency: "usd",
    tags: {
      category: "top",
      subcategory: null,
      colors: [{ name: "oat", hex: "#e8dcc4" }, { name: "sky", hex: "blue" }],
      colorFamily: "cream",
      pattern: null,
      materials: ["linen"],
      fit: "relaxed",
      formality: 2,
      tempRangeF: { min: 85, max: 60 },
      occasions: ["social"],
      notes: null,
    },
    onModel: true,
    productBox: { x_min: 100, y_min: 200, x_max: 1005, y_max: 700 },
    sources: [
      { field: "materials", url: "https://acme.example/shirt" },
      { field: "fit", url: "https://made.up/page" },
    ],
    lowConfidence: ["fit"],
  };
  const SEARCH = {
    type: "web_search_call",
    id: "ws_1",
    status: "completed",
    action: { type: "search", queries: ["acme linen shirt"], sources: [{ type: "url", url: "https://acme.example/shirt" }] },
  };

  it("sends the screenshot inline and turns on web search when allowed", async () => {
    create.mockResolvedValue(reply(WIRE, { output: [SEARCH] }));
    await extractItem({ knownFields: {}, images: [], screenshot: SCREENSHOT, allowWebSearch: true }, LIVE);
    const [body, options] = create.mock.calls[0];
    expect(body.tools).toEqual([{ type: "web_search", search_context_size: "low" }]);
    expect(body.include).toContain("web_search_call.action.sources");
    expect(body.input[0].content).toContainEqual({
      type: "input_image",
      image_url: "data:image/jpeg;base64,AAAA",
      detail: "auto",
    });
    expect(options.timeout).toBe(120_000);
  });

  it("maps the answer to the app shape", async () => {
    create.mockResolvedValue(reply(WIRE, { output: [SEARCH] }));
    const out = await extractItem({ knownFields: {}, images: [], screenshot: SCREENSHOT, allowWebSearch: true }, LIVE);
    expect(out).toMatchObject({
      title: "Linen shirt",
      brand: "Acme",
      priceCents: 4990,
      currency: "USD",
      productBox: { x: 0.1, y: 0.2, width: 0.9, height: 0.5 },
      sources: [{ field: "materials", url: "https://acme.example/shirt" }],
    });
    expect(out.tags.colors).toEqual([{ name: "oat", hex: "#e8dcc4" }, { name: "sky" }]);
    expect(out.tags.tempRangeF).toEqual({ min: 60, max: 85 });
    expect(out.tags.subcategory).toBeUndefined();
    // 1000 in + 1000 out + one search at $0.0025
    expect(spentTodayUsd()).toBeCloseTo(0.008, 6);
  });

  it("drops a box with no area and sends no tools without search", async () => {
    create.mockResolvedValue(reply({ ...WIRE, productBox: { x_min: 300, y_min: 10, x_max: 300, y_max: 90 } }));
    const out = await extractItem({ knownFields: {}, images: [], screenshot: SCREENSHOT, allowWebSearch: false }, LIVE);
    expect(out.productBox).toBeUndefined();
    expect(out.sources).toEqual([]);
    expect(create.mock.calls[0][0].tools).toBeUndefined();
  });

  it("does not read images from storage yet", async () => {
    await expect(
      extractItem({ knownFields: {}, images: [{ kind: "storage", path: "a/b.webp" }], allowWebSearch: false }, LIVE),
    ).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(create).not.toHaveBeenCalled();
  });
});
