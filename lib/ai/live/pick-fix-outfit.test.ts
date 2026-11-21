import type { Response } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_COST_USD, memoryBudgetStore, setBudgetStore } from "../budget";
import { AiOutputError } from "../errors";
import { pickFixOutfit } from "../index";
import { FIX_REASON_WORD_LIMIT } from "../schemas/pick-fix-outfit";
import { FixWire, PICK_FIX_OUTFIT_INSTRUCTIONS, toFixOutput } from "./pick-fix-outfit";

const create = vi.fn();
vi.mock("./client", () => ({ getClient: async () => ({ responses: { create } }) }));

const LIVE = { mode: "live", record: false } as const;

function reply(json: unknown): Response {
  return {
    id: "resp_1",
    status: "completed",
    usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 0 }, output_tokens: 500, total_tokens: 1500 },
    output: [
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

const item = (id: string, title: string, category: "top" | "bottom" | "shoes" | "outerwear") => ({
  id,
  title,
  tags: {
    category,
    colors: [{ name: "white" }],
    materials: ["cotton"],
    formality: 3,
    occasions: ["work" as const],
    tempRangeF: { min: 50, max: 80 },
  },
});
const TEE = item("852c8e3d-abf7-4955-ab65-9d83194a02ae", "Beige tee", "top");
const JEANS = item("c81b2b56-1f62-4284-83b6-7307a6355ac5", "Jeans", "bottom");
const SHOES = item("23c59091-9b18-4c24-92c3-1072a5581d8e", "Sneakers", "shoes");
const BLAZER = item("5d0f6a3e-58f0-4a53-9d4c-3a1f1f0c7b11", "Black blazer", "outerwear");
const CLOSET = [JEANS, SHOES, BLAZER];
const PHOTO = { kind: "inline" as const, mime: "image/webp", base64: "AAAA" };

const input = {
  item: { ...TEE, photo: PHOTO },
  complaints: [
    { aspect: "color" as const, said: "washes me out", means: "pale near the face" },
    { aspect: "fit" as const, area: "neckline", said: "V is too deep", means: "neckline runs low" },
  ],
  lowRating: false,
  closet: CLOSET,
};

beforeEach(() => {
  create.mockReset();
  setBudgetStore(memoryBudgetStore());
});

describe("pickFixOutfit", () => {
  it("sends the piece with its photo, its complaints and the numbered closet items as text", async () => {
    create.mockResolvedValue(reply({ reason: "The black blazer covers the neckline.", pieces: [3, 1, 2] }));
    await expect(pickFixOutfit(input, LIVE)).resolves.toEqual({
      itemIds: [BLAZER.id, JEANS.id, SHOES.id],
      reason: "The black blazer covers the neckline.",
    });
    const [body, options] = create.mock.calls[0];
    expect(body).toMatchObject({ max_output_tokens: 3000, store: false, text: { format: { name: "fix_outfit", strict: true } } });
    expect(body.tools).toBeUndefined();
    expect(options).toEqual({ timeout: 60_000, maxRetries: 1 });
    const content = body.input[0].content;
    const text: string = content[0].text;
    expect(text).toContain("The piece: Beige tee: top;");
    expect(text).toContain("comfortable 50 to 80°F");
    expect(text).toContain('- color: said "washes me out"; means "pale near the face"');
    expect(text).toContain('- fit (neckline): said "V is too deep"; means "neckline runs low"');
    expect(text).toContain("Star rating: not low");
    expect(text).toContain("I1: Jeans: bottom;");
    expect(text).toContain("I3: Black blazer: outerwear;");
    // One photo, the piece's own.
    expect(content.slice(1)).toEqual([
      { type: "input_text", text: "Photo of the piece:" },
      { type: "input_image", image_url: "data:image/webp;base64,AAAA", detail: "auto" },
    ]);
  });

  it("says the piece is rated low with no reason given, and goes as text without a photo", async () => {
    create.mockResolvedValue(reply({ reason: "Dark jeans make the beige look warm.", pieces: [1, 2] }));
    await pickFixOutfit({ item: TEE, complaints: [], lowRating: true, closet: CLOSET }, LIVE);
    const content = create.mock.calls[0][0].input[0].content;
    expect(content).toHaveLength(1);
    expect(content[0].text).toContain("Complaints: none written.\nStar rating: low (1 or 2 of 5)");
    expect(PICK_FIX_OUTFIT_INSTRUCTIONS).toContain("shows the piece at its best");
  });

  it("allows the answer that nothing helps", async () => {
    create.mockResolvedValue(reply({ reason: "", pieces: [] }));
    await expect(pickFixOutfit(input, LIVE)).resolves.toEqual({ itemIds: [], reason: "" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("treats a number outside the list as no pick, without asking again", async () => {
    create.mockResolvedValue(reply({ reason: "The red coat hides it.", pieces: [1, 2, 7] }));
    await expect(pickFixOutfit(input, LIVE)).resolves.toEqual({ itemIds: [], reason: "" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("asks once more after an answer that doesn't fit, then gives up", async () => {
    create.mockResolvedValueOnce(reply({ pieces: [1] })).mockResolvedValueOnce(reply({ reason: "Dark jeans add contrast.", pieces: [1, 2] }));
    await expect(pickFixOutfit(input, LIVE)).resolves.toMatchObject({ itemIds: [JEANS.id, SHOES.id] });
    expect(create).toHaveBeenCalledTimes(2);

    create.mockClear();
    const tooLong = Array.from({ length: FIX_REASON_WORD_LIMIT + 1 }, () => "word").join(" ");
    create.mockResolvedValue(reply({ reason: tooLong, pieces: [1, 2] }));
    await expect(pickFixOutfit(input, LIVE)).rejects.toBeInstanceOf(AiOutputError);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("holds a worst-case cost in line with judgeRepeat's", () => {
    expect(MAX_COST_USD.pickFixOutfit).toBe(MAX_COST_USD.judgeRepeat);
  });
});

describe("toFixOutput", () => {
  it("only ever answers items from the list", () => {
    expect(toFixOutput(CLOSET, FixWire.parse({ reason: " ok ", pieces: [2, 1] }))).toEqual({ itemIds: [SHOES.id, JEANS.id], reason: "ok" });
    expect(toFixOutput(CLOSET, FixWire.parse({ reason: "r", pieces: [4] }))).toEqual({ itemIds: [], reason: "" });
    expect(toFixOutput(CLOSET, FixWire.parse({ reason: "ignored", pieces: [] }))).toEqual({ itemIds: [], reason: "" });
    expect(FixWire.safeParse({ reason: "r", pieces: [0] }).success).toBe(false);
    expect(FixWire.safeParse({ reason: "r", pieces: [1], itemIds: [TEE.id] }).success).toBe(false);
  });
});
