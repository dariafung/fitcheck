import { describe, expect, it } from "vitest";
import type { Category, FeelingStructured } from "../ai/schemas/common";
import {
  FIT_QUESTIONS,
  fitAnswers,
  hasBasis,
  MAX_ANCHORS,
  NO_ANSWER_REASON,
  NO_DATA_REASON,
  pickAnchors,
  toAnchor,
  troubleAreas,
} from "./fit-questions";
import { makeItem } from "./fixtures";
import { CANDIDATE_ITEM_ID } from "./pairings";
import { NO_DATA_POINTS, POINTS_PER_YES } from "./score";

let next = 0;
function item(category: Category) {
  next += 1;
  const id = `00000000-0000-4000-8000-${String(next).padStart(12, "0")}`;
  return makeItem(id, `${category} ${next}`, { category, formality: 3, occasions: [] });
}

function feeling(over: Partial<FeelingStructured> = {}): FeelingStructured {
  return { flattering: "unknown", liked: "unknown", aspects: [], occasions: [], mood: [], summary: "", ...over };
}

describe("pickAnchors", () => {
  it("keeps flattering or liked items, same category first, then by id", () => {
    const [shoe, top1, top2, meh] = [item("shoes"), item("top"), item("top"), item("top")];
    const feelings = new Map([
      [shoe.id, feeling({ liked: "yes" })],
      [top2.id, feeling({ flattering: "yes" })],
      [top1.id, feeling({ liked: "yes" })],
      [meh.id, feeling({ liked: "mixed" })],
    ]);
    const candidate = { ...item("top"), id: CANDIDATE_ITEM_ID };
    expect(pickAnchors([shoe, top1, top2, meh], feelings, candidate).map((a) => a.item.id)).toEqual([
      top1.id,
      top2.id,
      shoe.id,
    ]);
  });

  it(`sends at most ${MAX_ANCHORS}`, () => {
    const items = Array.from({ length: MAX_ANCHORS + 3 }, () => item("top"));
    const feelings = new Map(items.map((i) => [i.id, feeling({ liked: "yes" })]));
    expect(pickAnchors(items, feelings, item("top"))).toHaveLength(MAX_ANCHORS);
  });
});

describe("troubleAreas", () => {
  it("collects areas of bad fit aspects once, alphabetically", () => {
    const fit = (area: string | undefined, sentiment: "positive" | "negative" = "negative", aspect: "fit" | "color" = "fit") =>
      ({ aspect, sentiment, area, said: "", means: "" });
    const areas = troubleAreas([
      feeling({ aspects: [fit("Hips"), fit("waist", "positive"), fit(undefined)] }),
      feeling({ aspects: [fit("hips "), fit("Arms"), fit("neckline", "negative", "color")] }),
    ]);
    expect(areas).toEqual(["Arms", "Hips"]);
  });
});

describe("hasBasis", () => {
  it("needs anchors of the right kind, or trouble areas", () => {
    const anchors = [{ item: item("top"), feeling: feeling({ liked: "yes" }) }];
    expect(hasBasis("liked", anchors, [])).toBe(true);
    expect(hasBasis("flattering", anchors, [])).toBe(false);
    expect(hasBasis("troubleAreas", anchors, [])).toBe(false);
    expect(hasBasis("troubleAreas", [], ["hips"])).toBe(true);
  });
});

describe("toAnchor", () => {
  it("passes the feeling without the verdicts", () => {
    const anchor = toAnchor({ item: item("top"), feeling: feeling({ flattering: "yes", mood: ["calm"], summary: "Fits well" }) });
    expect(anchor).toMatchObject({ flattering: true, liked: false, feeling: { aspects: [], mood: ["calm"], summary: "Fits well" } });
  });
});

describe("fitAnswers", () => {
  it("scores yes, no, missing answers and unasked questions", () => {
    const [cut, trouble, color] = FIT_QUESTIONS;
    const answers = fitAnswers([cut, trouble, color], {
      answers: [
        { id: cut.id, answer: true, reason: "Same wide leg." },
        { id: trouble.id, answer: false, reason: "Clings at the hips." },
      ],
      summary: "",
    });
    expect(answers.map((a) => [a.id, a.answer, a.points])).toEqual([
      [cut.id, true, POINTS_PER_YES],
      [trouble.id, false, 0],
      [color.id, false, 0],
      ["style_liked", null, NO_DATA_POINTS],
      ["feel_liked", null, NO_DATA_POINTS],
    ]);
    expect(answers[2].reason).toBe(NO_ANSWER_REASON);
    expect(answers[3].reason).toBe(NO_DATA_REASON);
  });

  it("gives half points everywhere when nothing was asked", () => {
    const answers = fitAnswers([], null);
    expect(answers.reduce((s, a) => s + a.points, 0)).toBe(FIT_QUESTIONS.length * NO_DATA_POINTS);
  });
});
