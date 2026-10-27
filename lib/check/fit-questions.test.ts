import { describe, expect, it } from "vitest";
import type { Category, FeelingAspect, FeelingStructured } from "../ai/schemas/common";
import {
  FIT_QUESTIONS,
  fitAnswers,
  hasBasis,
  NO_ANSWER_REASON,
  NO_DATA_REASON,
  pickFeltItems,
  toFeltItem,
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

function aspect(over: Partial<FeelingAspect> & Pick<FeelingAspect, "aspect">): FeelingAspect {
  return { sentiment: "negative", said: "", means: "", ...over };
}

const [cutQ, troubleQ, colorQ, styleQ, feelQ] = FIT_QUESTIONS;

describe("pickFeltItems", () => {
  it("keeps every item with a feeling: same category first, then ones with aspects, then by id", () => {
    const [shoe, top1, top2, top3, none] = [item("shoes"), item("top"), item("top"), item("top"), item("top")];
    const feelings = new Map([
      [shoe.id, feeling({ liked: "yes" })],
      [top3.id, feeling({ aspects: [aspect({ aspect: "color" })] })],
      [top2.id, feeling({ flattering: "no" })],
      [top1.id, feeling({ liked: "mixed" })],
    ]);
    const candidate = { ...item("top"), id: CANDIDATE_ITEM_ID };
    expect(pickFeltItems([shoe, top1, top2, top3, none], feelings, candidate).map((r) => r.item.id)).toEqual([
      top3.id,
      top1.id,
      top2.id,
      shoe.id,
    ]);
  });

  it("has no cap", () => {
    const items = Array.from({ length: 80 }, () => item("top"));
    const feelings = new Map(items.map((i) => [i.id, feeling()]));
    expect(pickFeltItems(items, feelings, item("top"))).toHaveLength(80);
  });
});

describe("troubleAreas", () => {
  it("collects areas of bad fit aspects once, alphabetically", () => {
    const areas = troubleAreas([
      feeling({
        aspects: [
          aspect({ aspect: "fit", area: "Hips" }),
          aspect({ aspect: "fit", area: "waist", sentiment: "positive" }),
          aspect({ aspect: "fit" }),
        ],
      }),
      feeling({
        aspects: [
          aspect({ aspect: "fit", area: "hips " }),
          aspect({ aspect: "fit", area: "Arms" }),
          aspect({ aspect: "color", area: "neckline" }),
        ],
      }),
    ]);
    expect(areas).toEqual(["Arms", "Hips"]);
  });
});

describe("hasBasis", () => {
  const rows = (f: FeelingStructured) => [{ item: item("top"), feeling: f }];

  it("counts any verdict but unknown, good or bad", () => {
    expect(hasBasis(colorQ.basis, rows(feeling({ liked: "no" })), [])).toBe(true);
    expect(hasBasis(cutQ.basis, rows(feeling({ flattering: "mixed" })), [])).toBe(true);
    expect(hasBasis(cutQ.basis, rows(feeling({ liked: "yes" })), [])).toBe(false);
  });

  it("counts aspects of the question's kind", () => {
    const f = feeling({ aspects: [aspect({ aspect: "length" }), aspect({ aspect: "feel", sentiment: "positive" })] });
    expect(hasBasis(cutQ.basis, rows(f), [])).toBe(true);
    expect(hasBasis(feelQ.basis, rows(f), [])).toBe(true);
    expect(hasBasis(colorQ.basis, rows(f), [])).toBe(false);
    expect(hasBasis(styleQ.basis, rows(f), [])).toBe(false);
  });

  it("asks about trouble areas only when there are some", () => {
    expect(hasBasis(troubleQ.basis, rows(feeling({ flattering: "no" })), [])).toBe(false);
    expect(hasBasis(troubleQ.basis, [], ["hips"])).toBe(true);
  });
});

describe("toFeltItem", () => {
  it("passes the verdicts as they are, with aspects, mood and summary", () => {
    const shoulders = aspect({ aspect: "fit", area: "shoulders", said: "tight", means: "narrow shoulders" });
    const felt = toFeltItem({
      item: item("top"),
      feeling: feeling({ flattering: "no", liked: "mixed", aspects: [shoulders], mood: ["calm"], summary: "Tight" }),
    });
    expect(felt.feeling).toEqual({ flattering: "no", liked: "mixed", aspects: [shoulders], mood: ["calm"], summary: "Tight" });
    expect(felt).not.toHaveProperty("flattering");
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
