import type { Response } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PHOTO_SCORE_CASES, SCORE_CASES, STYLED_SCORE_CASES } from "@/tests/record/cases";
import { memoryBudgetStore, setBudgetStore } from "../budget";
import { scorePurchase } from "../index";
import type { ScorePurchaseInput } from "../schemas/score-purchase";

const create = vi.fn();
vi.mock("./client", () => ({ getClient: async () => ({ responses: { create } }) }));

const LIVE = { mode: "live", record: false } as const;

function reply(questions: number): Response {
  const answers = Array.from({ length: questions }, (_, i) => ({ question: i + 1, reason: "Fine.", score: 4 }));
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
        content: [{ type: "output_text", text: JSON.stringify({ answers, summary: "Fine." }), annotations: [] }],
      },
    ],
  } as unknown as Response;
}

// The request body sent to the model.
async function request(input: ScorePurchaseInput) {
  create.mockResolvedValueOnce(reply(input.questions.length));
  await scorePurchase(input, LIVE);
  return create.mock.calls[0][0];
}

const BARE: ScorePurchaseInput = {
  ...SCORE_CASES[0].input,
  profile: { lifestyleMix: { work: 0, school: 0, social: 0, sport: 0, home: 0 } },
  feltItems: [],
  troubleAreas: [],
};

beforeEach(() => {
  create.mockReset();
  setBudgetStore(memoryBudgetStore());
});

describe("scorePurchase request without a style card", () => {
  // Captured before the style card was added (score-purchase@4): without a
  // card the request must stay byte for byte the same.
  it("matches the request from before style cards, with felt items", async () => {
    await expect(JSON.stringify(await request(SCORE_CASES[0].input), null, 2)).toMatchFileSnapshot(
      "./__snapshots__/score-purchase-felt.json",
    );
  });

  it("matches the request from before style cards, with nothing to go on", async () => {
    await expect(JSON.stringify(await request(BARE), null, 2)).toMatchFileSnapshot(
      "./__snapshots__/score-purchase-bare.json",
    );
  });
});

describe("scorePurchase request with a style card", () => {
  const styled = STYLED_SCORE_CASES[0].input;
  const { styleProfile, ...unstyled } = styled;
  const text = (body: { input: { content: { text: string }[] }[] }) => body.input[0].content[0].text;

  it("adds the card after the questions and changes nothing else", async () => {
    const without = await request(unstyled);
    create.mockClear();
    const withCard = await request(styled);
    expect(withCard.instructions).toBe(without.instructions);
    expect(text(withCard).startsWith(`${text(without)}\n\nStyle summary of their whole closet`)).toBe(true);
    expect({ ...withCard, input: null }).toEqual({ ...without, input: null });
  });

  it("sends each line with its topic and sign, and nothing but the lines", async () => {
    const section = text(await request(styled)).split("Style summary of their whole closet")[1];
    expect(section).toContain("\n+ color: Crisp white and soft neutrals brighten you");
    expect(section).toContain("\n- length: Cropped lengths ride up on you");
    const lines = section.split("\n").filter((l) => /^[+-] (color|fit|feel|length|style): /.test(l));
    expect(lines).toHaveLength(styleProfile!.length);
    expect(section).not.toMatch(/occasion|[0-9a-f]{8}-[0-9a-f]{4}/);
  });
});

describe("scorePurchase request with photos", () => {
  const input = PHOTO_SCORE_CASES[0].input;
  const content = async (i: ScorePurchaseInput) =>
    (await request(i)).input[0].content as { type: string; text?: string; image_url?: string }[];

  it("puts the photos after the text, each after its label", async () => {
    const [text, rules, ...photos] = await content(input);
    expect(text.text).toMatch(/^Candidate: /);
    expect(rules.text).toMatch(/^Photos of some of these items follow/);
    const labels = photos.filter((c) => c.type === "input_text").map((c) => c.text);
    expect(labels).toEqual(["Candidate:", "F1:", "F2:", "F3:", "F4:", "F5:", "F6:"]);
    expect(photos.filter((c) => c.type === "input_image")).toHaveLength(labels.length);
    expect(photos[1].image_url).toBe(`data:image/webp;base64,${input.candidate.photo?.kind === "inline" && input.candidate.photo.base64}`);
  });

  it("labels felt photos by their number, and skips stored ones", async () => {
    const felt = input.feltItems.map((item, i) => {
      if (i === 2) return { ...item, photo: { kind: "storage" as const, path: "a/b.webp" } };
      return i === 4 ? item : { ...item, photo: undefined };
    });
    const { photo, ...candidate } = input.candidate;
    expect(photo).toBeDefined();
    const labels = (await content({ ...input, candidate, feltItems: felt }))
      .filter((c) => c.type === "input_text")
      .map((c) => c.text);
    expect(labels.slice(2)).toEqual(["F5:"]);
  });

  it("sends the text alone without photos", async () => {
    expect(await content(SCORE_CASES[0].input)).toHaveLength(1);
  });
});
