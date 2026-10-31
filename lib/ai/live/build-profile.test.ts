import type { Response } from "openai/resources/responses/responses";
import type { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryBudgetStore, setBudgetStore } from "../budget";
import { AiOutputError } from "../errors";
import { buildProfile } from "../index";
import { BuildProfileInput, profileFacts } from "../schemas/build-profile";
import type { ItemSummary } from "../schemas/common";
import { BUILD_PROFILE_INSTRUCTIONS, profilePrompt, ProfileWire, toProfileOutput } from "./build-profile";

const create = vi.fn();
vi.mock("./client", () => ({ getClient: async () => ({ responses: { create } }) }));

const LIVE = { mode: "live", record: false } as const;

function reply(json: unknown): Response {
  return {
    id: "resp_1",
    status: "completed",
    usage: { input_tokens: 1000, output_tokens: 1000, total_tokens: 2000 },
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

const SHIRT: ItemSummary = {
  id: "852c8e3d-abf7-4955-ab65-9d83194a02ae",
  title: "White shirt",
  tags: { category: "top", colors: [{ name: "white" }], materials: ["cotton"], fit: "regular", formality: 3, occasions: ["work"] },
};
const JEANS: ItemSummary = {
  id: "c81b2b56-1f62-4284-83b6-7307a6355ac5",
  title: "Dark jeans",
  tags: { category: "bottom", colors: [{ name: "indigo" }], materials: ["denim"], formality: 2, occasions: ["school"] },
};
const TEE: ItemSummary = {
  id: "23c59091-9b18-4c24-92c3-1072a5581d8e",
  title: "Gray tee",
  tags: { category: "top", colors: [{ name: "gray" }], materials: ["cotton"], formality: 1, occasions: ["school", "sport"] },
};

const INPUT = BuildProfileInput.parse({
  items: [SHIRT, JEANS, TEE],
  feelings: [
    {
      itemId: SHIRT.id,
      flattering: "yes",
      liked: "yes",
      aspects: [
        { aspect: "color", sentiment: "positive", said: "the color makes me look awake", means: "white brightens your face" },
        { aspect: "feel", sentiment: "positive", said: "so comfy", means: "so comfy" },
      ],
      occasions: ["school"],
      mood: ["awake"],
      summary: "Comfy white shirt that looks awake.",
    },
    {
      itemId: JEANS.id,
      flattering: "no",
      liked: "no",
      aspects: [
        { aspect: "fit", sentiment: "negative", area: "waist", said: "the waist digs in when I sit", means: "waistbands need give" },
      ],
      occasions: [],
      mood: [],
      summary: "Waist digs in.",
    },
    { itemId: TEE.id, flattering: "unknown", liked: "yes", occasions: [], mood: [], summary: "Likes it." },
  ],
});

const WIRE: z.output<typeof ProfileWire> = {
  suits: [
    { topic: "feel", text: "Soft cotton you can move in.", items: [1, 3] },
    { topic: "color", text: "Light, bright colors near your face.", items: [1] },
    { topic: "occasion", text: "Mostly for school days.", items: [2, 3] },
  ],
  avoid: [{ topic: "fit", text: "Waistbands without any give.", items: [2] }],
  headline: { text: "Easy cotton basics in light colors.", items: [1, 3] },
};

beforeEach(() => {
  create.mockReset();
  setBudgetStore(memoryBudgetStore());
});

describe("profileFacts", () => {
  it("covers topics the tags or feelings give something to go on", () => {
    expect(profileFacts(INPUT).topics).toEqual(["color", "fit", "feel", "style", "occasion"]);
  });

  it("covers length only when a feeling talks about it", () => {
    const withLength = BuildProfileInput.parse({
      ...INPUT,
      feelings: [
        ...INPUT.feelings,
        { itemId: TEE.id, flattering: "no", liked: "unknown", aspects: [{ aspect: "length", sentiment: "negative", said: "too short", means: "too short" }], occasions: [], mood: [], summary: "" },
      ],
    });
    expect(profileFacts(withLength).topics).toContain("length");
  });

  it("counts occasions from tags and feelings, most first", () => {
    expect(profileFacts(INPUT).occasions).toEqual([
      { occasion: "school", items: 2, feelings: 1 },
      { occasion: "work", items: 1, feelings: 0 },
      { occasion: "sport", items: 1, feelings: 0 },
    ]);
  });

  it("asks for something to skip only when a feeling is negative", () => {
    expect(profileFacts(INPUT).needsAvoid).toBe(true);
    const happy = BuildProfileInput.parse({ ...INPUT, feelings: [INPUT.feelings[0]] });
    expect(profileFacts(happy).needsAvoid).toBe(false);
  });
});

describe("profilePrompt", () => {
  it("numbers items and gives what each aspect means, not the summary", () => {
    const prompt = profilePrompt(INPUT);
    expect(prompt).toContain("Topics to cover: color, fit, feel, style, occasion");
    expect(prompt).toContain("school: 2 items, 1 feeling");
    expect(prompt).toMatch(/^I1: White shirt:/m);
    expect(prompt).toContain("+ color: white brightens your face");
    expect(prompt).toContain("- fit (waist): waistbands need give");
    // means is sent even when it's what was said word for word.
    expect(prompt).toContain("+ feel: so comfy");
    for (const said of ["look awake", "digs in", "Comfy white shirt", "Waist digs in"]) {
      expect(prompt).not.toContain(said);
    }
  });
});

describe("toProfileOutput", () => {
  it("maps item numbers to ids and orders statements by topic", () => {
    expect(toProfileOutput(INPUT, WIRE)).toEqual({
      headline: { text: "Easy cotton basics in light colors.", evidenceItemIds: [SHIRT.id, TEE.id] },
      suits: [
        { topic: "color", text: "Light, bright colors near your face.", evidenceItemIds: [SHIRT.id] },
        { topic: "feel", text: "Soft cotton you can move in.", evidenceItemIds: [SHIRT.id, TEE.id] },
        { topic: "occasion", text: "Mostly for school days.", evidenceItemIds: [JEANS.id, TEE.id] },
      ],
      avoid: [{ topic: "fit", text: "Waistbands without any give.", evidenceItemIds: [JEANS.id] }],
    });
  });

  it("drops items out of range and statements left with none", () => {
    const out = toProfileOutput(INPUT, {
      ...WIRE,
      suits: [{ topic: "color", text: "Light colors.", items: [1, 9] }, { topic: "style", text: "Simple pieces.", items: [7] }],
    });
    expect(out?.suits).toEqual([{ topic: "color", text: "Light colors.", evidenceItemIds: [SHIRT.id] }]);
  });

  it("keeps the first statement per topic on each side, and no occasion to avoid", () => {
    const out = toProfileOutput(INPUT, {
      ...WIRE,
      suits: [
        { topic: "color", text: "Light colors.", items: [1] },
        { topic: "color", text: "Bright colors.", items: [1] },
      ],
      avoid: [{ topic: "occasion", text: "Going out.", items: [1] }],
    });
    expect(out?.suits.map((s) => s.text)).toEqual(["Light colors."]);
    expect(out?.avoid).toEqual([]);
  });

  it("is null without a usable headline or anything that suits", () => {
    expect(toProfileOutput(INPUT, { ...WIRE, headline: { text: "  ", items: [1, 3] } })).toBeNull();
    expect(toProfileOutput(INPUT, { ...WIRE, headline: { text: "Easy basics.", items: [1] } })).toBeNull();
    expect(toProfileOutput(INPUT, { ...WIRE, suits: [] })).toBeNull();
  });
});

describe("liveBuildProfile", () => {
  it("sends fixed instructions and the numbered closet as strict JSON", async () => {
    create.mockResolvedValue(reply(WIRE));
    const out = await buildProfile(INPUT, LIVE);
    expect(out.suits).toHaveLength(3);
    const [body] = create.mock.calls[0];
    expect(body.instructions).toBe(BUILD_PROFILE_INSTRUCTIONS);
    expect(body.input[0].content[0].text).toBe(profilePrompt(INPUT));
    expect(body.text.format).toMatchObject({ type: "json_schema", name: "style_profile", strict: true });
    expect(body.max_output_tokens).toBe(5000);
  });

  it("asks again when the answer can't be used, then gives up", async () => {
    create.mockResolvedValue(reply({ ...WIRE, suits: [] }));
    await expect(buildProfile(INPUT, LIVE)).rejects.toBeInstanceOf(AiOutputError);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
