import OpenAI from "openai";
import type { Response } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryBudgetStore, setBudgetStore, spentTodayUsd } from "../budget";
import { AiNotConfiguredError, AiOutputError, AiUpstreamError } from "../errors";
import { extractItem, judgePairing, judgeRepeat, parseFeeling, scorePurchase } from "../index";
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
  aspects: [
    { aspect: "feel", sentiment: "positive", area: null, said: "comfortable", means: "comfortable" },
    { aspect: "fit", sentiment: "negative", area: "shoulders", said: "tight in the shoulders", means: "shoulders run narrow" },
  ],
  occasions: ["work"],
  mood: ["calm"],
  summary: "Comfortable but tight in the shoulders.",
};
// What parseFeeling returns: a null area is left out.
const PARSED = {
  ...FEELING,
  aspects: [{ aspect: "feel", sentiment: "positive", said: "comfortable", means: "comfortable" }, FEELING.aspects[1]],
};

beforeEach(() => {
  create.mockReset();
  setBudgetStore(memoryBudgetStore());
});

describe("shared request", () => {
  it("asks muse-spark-1.3 for strict JSON, unstored, with low reasoning", async () => {
    create.mockResolvedValue(reply(FEELING));
    await expect(parseFeeling({ text: "Comfy, tight shoulders", item: SHIRT }, LIVE)).resolves.toEqual(PARSED);
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
    expect(await spentTodayUsd()).toBeCloseTo(0.0055, 6);
  });

  it("retries once when the answer is cut off, then gives up", async () => {
    create.mockResolvedValue(reply(FEELING, { status: "incomplete" }));
    await expect(parseFeeling({ text: "Fine", item: SHIRT }, LIVE)).rejects.toBeInstanceOf(AiOutputError);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("retries once when the text is not the expected JSON", async () => {
    create.mockResolvedValueOnce(reply({ nope: true })).mockResolvedValueOnce(reply(FEELING));
    await expect(parseFeeling({ text: "Fine", item: SHIRT }, LIVE)).resolves.toEqual(PARSED);
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
    size: " Size: S ",
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
      size: "S",
      productBox: { x: 0.1, y: 0.2, width: 0.9, height: 0.5 },
      sources: [{ field: "materials", url: "https://acme.example/shirt" }],
    });
    expect(out.tags.colors).toEqual([{ name: "oat", hex: "#e8dcc4" }, { name: "sky" }]);
    expect(out.tags.tempRangeF).toEqual({ min: 60, max: 85 });
    expect(out.tags.subcategory).toBeUndefined();
    // 1000 in + 1000 out + one search at $0.0025
    expect(await spentTodayUsd()).toBeCloseTo(0.008, 6);
  });

  it("reads only the last message when the model comments between searches", async () => {
    const commentary = (text: string) => ({
      type: "message",
      id: "rs_1",
      role: "assistant",
      status: "completed",
      phase: "commentary",
      content: [{ type: "output_text", text, annotations: [] }],
    });
    create.mockResolvedValue(
      reply(WIRE, { output: [commentary("I'll search for the materials."), SEARCH, commentary("Found them.")] }),
    );
    const out = await extractItem({ knownFields: {}, images: [], screenshot: SCREENSHOT, allowWebSearch: true }, LIVE);
    expect(out.title).toBe("Linen shirt");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("drops a box with no area and sends no tools without search", async () => {
    create.mockResolvedValue(reply({ ...WIRE, productBox: { x_min: 300, y_min: 10, x_max: 300, y_max: 90 } }));
    const out = await extractItem({ knownFields: {}, images: [], screenshot: SCREENSHOT, allowWebSearch: false }, LIVE);
    expect(out.productBox).toBeUndefined();
    expect(out.sources).toEqual([]);
    expect(create.mock.calls[0][0].tools).toBeUndefined();
  });

  it("gives no size when the model reads none", async () => {
    create.mockResolvedValue(reply({ ...WIRE, size: null }));
    const out = await extractItem({ knownFields: {}, images: [], screenshot: SCREENSHOT, allowWebSearch: false }, LIVE);
    expect(out.size).toBeUndefined();
  });

  it("does not read images from storage yet", async () => {
    await expect(
      extractItem({ knownFields: {}, images: [{ kind: "storage", path: "a/b.webp" }], allowWebSearch: false }, LIVE),
    ).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("scorePurchase", () => {
  const LIFESTYLE = { work: 0, school: 3, social: 2, sport: 3, home: 3 };
  const QUESTIONS = [
    { id: "cut", text: "Is the cut like the flattering ones?" },
    { id: "color", text: "Is the color liked?" },
    { id: "feel", text: "Does it feel right?" },
  ];
  const input = {
    candidate: { ...SHIRT, id: "00000000-0000-4000-8000-000000000000", title: "Slim boat-neck top" },
    profile: { bodyShape: "pear", heightCm: 165, lifestyleMix: LIFESTYLE },
    feltItems: [
      {
        ...SHIRT,
        feeling: {
          flattering: "yes" as const,
          liked: "yes" as const,
          aspects: [
            { aspect: "feel" as const, sentiment: "positive" as const, said: "comfortable", means: "comfortable" },
            { aspect: "fit" as const, sentiment: "negative" as const, area: "shoulders", said: "tight", means: "narrow shoulders" },
          ],
          mood: [],
          summary: "",
        },
      },
      {
        ...JEANS,
        feeling: {
          flattering: "no" as const,
          liked: "no" as const,
          aspects: [
            { aspect: "fit" as const, sentiment: "negative" as const, area: "waist", said: "digs in", means: "needs a roomier waist" },
          ],
          mood: [],
          summary: "Never worn.",
        },
      },
    ],
    troubleAreas: ["shoulders", "waist"],
    questions: QUESTIONS,
  };
  const ALL_ANSWERED = {
    answers: QUESTIONS.map((_, i) => ({ question: i + 1, reason: "r", score: 4 })),
    summary: "s",
  };

  it("sends felt items good and bad, trouble areas and numbered questions", async () => {
    create.mockResolvedValue(reply(ALL_ANSWERED));
    await scorePurchase(input, LIVE);
    const [body] = create.mock.calls[0];
    expect(body).toMatchObject({ max_output_tokens: 4000, text: { format: { name: "fit_answers", strict: true } } });
    const text: string = body.input[0].content[0].text;
    expect(text).toContain("Candidate: Slim boat-neck top: top;");
    expect(text).toContain("Owner: body shape pear; height 165 cm");
    expect(text).toContain("Trouble areas (fit felt bad here): shoulders, waist");
    expect(text).toContain("F1: White shirt:");
    expect(text).toContain("feeling: flattering yes, liked yes | + feel: comfortable -> comfortable; - fit (shoulders):");
    expect(text).toContain("F2: Jeans:");
    expect(text).toContain("feeling: flattering no, liked no | - fit (waist): digs in -> needs a roomier waist | summary Never worn.");
    expect(text).toContain("Q1: Is the cut like the flattering ones?\nQ2: Is the color liked?\nQ3: Does it feel right?");
  });

  it("says so when there are no felt items or owner details", async () => {
    create.mockResolvedValue(reply(ALL_ANSWERED));
    await scorePurchase({ ...input, profile: { lifestyleMix: LIFESTYLE }, feltItems: [], troubleAreas: [] }, LIVE);
    const text: string = create.mock.calls[0][0].input[0].content[0].text;
    expect(text).toContain("Owner: not given\nTrouble areas (fit felt bad here): none");
    expect(text).toContain("Felt items:\nnone");
  });

  it("maps numbers back to ids in question order and drops repeats and unknown numbers", async () => {
    create.mockResolvedValue(
      reply({
        answers: [
          { question: 3, reason: "c", score: 1 },
          { question: 1, reason: "a", score: 7 },
          { question: 1, reason: "again", score: 0 },
          { question: 7, reason: "made up", score: 8 },
          { question: 2, reason: "b", score: 4 },
        ],
        summary: "Mostly suits you.",
      }),
    );
    await expect(scorePurchase(input, LIVE)).resolves.toEqual({
      answers: [
        { id: "cut", score: 7, reason: "a" },
        { id: "color", score: 4, reason: "b" },
        { id: "feel", score: 1, reason: "c" },
      ],
      summary: "Mostly suits you.",
    });
  });

  it("asks again when a question is left out, up to 4 calls in all", async () => {
    const partial = reply({ answers: [{ question: 1, reason: "a", score: 7 }], summary: "s" });
    create.mockResolvedValueOnce(partial).mockResolvedValueOnce(reply(ALL_ANSWERED));
    await expect(scorePurchase(input, LIVE)).resolves.toMatchObject({ answers: [{ id: "cut" }, { id: "color" }, { id: "feel" }] });
    expect(create).toHaveBeenCalledTimes(2);

    create.mockClear();
    create.mockResolvedValue(partial);
    await expect(scorePurchase(input, LIVE)).rejects.toBeInstanceOf(AiOutputError);
    expect(create).toHaveBeenCalledTimes(4);
  });

  it("asks again after a score above 8", async () => {
    const tooHigh = reply({ ...ALL_ANSWERED, answers: [{ question: 1, reason: "a", score: 9 }, ...ALL_ANSWERED.answers.slice(1)] });
    create.mockResolvedValueOnce(tooHigh).mockResolvedValueOnce(tooHigh).mockResolvedValueOnce(reply(ALL_ANSWERED));
    await expect(scorePurchase(input, LIVE)).resolves.toMatchObject({ summary: "s" });
    expect(create).toHaveBeenCalledTimes(3);
  });
});

describe("judgeRepeat", () => {
  const candidate = { ...SHIRT, id: "00000000-0000-4000-8000-000000000000", title: "Another white shirt" };
  const input = { candidate, closet: [JEANS, SHIRT, SHOES] };

  it("sends the candidate and numbered closet items", async () => {
    create.mockResolvedValue(reply({ reason: "Like your shirt.", closest: 2, score: 2 }));
    await expect(judgeRepeat(input, LIVE)).resolves.toEqual({ score: 2, closestId: SHIRT.id, reason: "Like your shirt." });
    const [body] = create.mock.calls[0];
    expect(body).toMatchObject({ max_output_tokens: 3000, text: { format: { name: "repeat", strict: true } } });
    const text: string = body.input[0].content[0].text;
    expect(text).toContain("Candidate: Another white shirt: top;");
    expect(text).toContain("Closet:\nI1: Jeans: bottom;");
    expect(text).toContain("I2: White shirt: top;");
    expect(text).toContain("I3: Sneakers: shoes;");
  });

  it("allows no closest item", async () => {
    create.mockResolvedValue(reply({ reason: "Nothing like it.", closest: null, score: 10 }));
    await expect(judgeRepeat(input, LIVE)).resolves.toEqual({ score: 10, closestId: null, reason: "Nothing like it." });
  });

  it("asks again when the closest number isn't in the closet, up to 4 calls in all", async () => {
    create
      .mockResolvedValueOnce(reply({ reason: "r", closest: 9, score: 3 }))
      .mockResolvedValueOnce(reply({ reason: "r", closest: 1, score: 9 }));
    await expect(judgeRepeat(input, LIVE)).resolves.toMatchObject({ closestId: JEANS.id, score: 9 });
    expect(create).toHaveBeenCalledTimes(2);

    create.mockClear();
    create.mockResolvedValue(reply({ reason: "r", closest: 2 }));
    await expect(judgeRepeat(input, LIVE)).rejects.toBeInstanceOf(AiOutputError);
    expect(create).toHaveBeenCalledTimes(4);
  });
});
