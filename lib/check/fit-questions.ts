// "Suits you": fixed yes/no questions for the model, asked against every
// owned item the user wrote a feeling about, good and bad. "Yes" is always
// the good answer; the model never scores.
import type { FeelingAspectKind, FeelingStructured, ItemSummary } from "../ai/schemas/common";
import type { FeltItem, ScorePurchaseOutput } from "../ai/schemas/score-purchase";
import { NO_DATA_POINTS, POINTS_PER_YES } from "./score";
import { categoryOf, type ClosetItem } from "./types";

// What a question compares against; with none of it, the question isn't
// asked. A verdict other than "unknown" counts too, so feelings parsed
// before aspects existed still give a basis.
type Basis =
  | { verdict: "flattering" | "liked"; aspects: readonly FeelingAspectKind[] }
  | "troubleAreas";

export interface FitQuestion {
  id: string;
  // For the model.
  text: string;
  // For the result page.
  label: string;
  basis: Basis;
}

export const FIT_QUESTIONS: readonly FitQuestion[] = [
  {
    id: "cut_flatters",
    text: "Is its cut, fit and length like the felt items the user says flatter them or fit well, and unlike the ones that don't?",
    label: "Cut like the ones that flatter you",
    basis: { verdict: "flattering", aspects: ["fit", "length"] },
  },
  {
    id: "spares_trouble_areas",
    text: "Does it avoid drawing attention to the body areas listed in troubleAreas?",
    label: "Easy on the spots you're unsure about",
    basis: "troubleAreas",
  },
  {
    id: "color_liked",
    text: "Is its color like the colors the user felt good about, and unlike the ones they felt bad about?",
    label: "A color you like",
    basis: { verdict: "liked", aspects: ["color"] },
  },
  {
    id: "style_liked",
    text: "Is its style (formality, pattern, kind of piece) like the felt items the user likes, and unlike the ones they don't?",
    label: "Your kind of style",
    basis: { verdict: "liked", aspects: ["style"] },
  },
  {
    id: "feel_liked",
    text: "Would its material and feel likely suit what the user says about how their clothes feel, good and bad?",
    label: "Feels like your favorites",
    basis: { verdict: "liked", aspects: ["feel"] },
  },
];

export const NO_DATA_REASON = "Not enough to go on yet.";
export const NO_ANSWER_REASON = "No answer this time.";

export interface FeltRow {
  item: ClosetItem;
  feeling: FeelingStructured;
}

// Every owned item with a feeling: same category first, then ones with
// aspects, then by id, so the same closet always sends the same table.
export function pickFeltItems(
  closet: readonly ClosetItem[],
  feelings: ReadonlyMap<string, FeelingStructured>,
  candidate: ClosetItem,
): FeltRow[] {
  const sameCategory = (item: ClosetItem) => (categoryOf(item) === categoryOf(candidate) ? 0 : 1);
  const noAspects = (f: FeelingStructured) => (f.aspects.length > 0 ? 0 : 1);
  return closet
    .flatMap((item) => {
      const feeling = feelings.get(item.id);
      return feeling ? [{ item, feeling }] : [];
    })
    .sort(
      (a, b) =>
        sameCategory(a.item) - sameCategory(b.item) ||
        noAspects(a.feeling) - noAspects(b.feeling) ||
        (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0),
    );
}

// Body areas of fit aspects the user felt bad about, deduplicated, alphabetical.
export function troubleAreas(feelings: Iterable<FeelingStructured>): string[] {
  const areas = new Map<string, string>();
  for (const feeling of feelings) {
    for (const { aspect, sentiment, area } of feeling.aspects) {
      const name = area?.trim();
      if (aspect !== "fit" || sentiment !== "negative" || !name) continue;
      if (!areas.has(name.toLowerCase())) areas.set(name.toLowerCase(), name);
    }
  }
  return [...areas.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, area]) => area);
}

export function hasBasis(basis: Basis, rows: readonly FeltRow[], trouble: readonly string[]) {
  if (basis === "troubleAreas") return trouble.length > 0;
  return rows.some(
    ({ feeling }) =>
      feeling[basis.verdict] !== "unknown" || feeling.aspects.some((a) => basis.aspects.includes(a.aspect)),
  );
}

export function toItemSummary(item: ClosetItem): ItemSummary {
  return { id: item.id, title: item.title, tags: item.tags };
}

export function toFeltItem({ item, feeling }: FeltRow): FeltItem {
  const { flattering, liked, aspects, mood, summary } = feeling;
  return { ...toItemSummary(item), feeling: { flattering, liked, aspects, mood, summary } };
}

export interface FitAnswer {
  id: string;
  question: string;
  // null: not asked, for lack of data.
  answer: boolean | null;
  reason: string;
  points: number;
}

// One answer per question, in FIT_QUESTIONS order. A question the model
// skipped counts as "no".
export function fitAnswers(
  asked: readonly FitQuestion[],
  output: ScorePurchaseOutput | null,
): FitAnswer[] {
  const askedIds = new Set(asked.map((q) => q.id));
  const byId = new Map(output?.answers.map((a) => [a.id, a]));
  return FIT_QUESTIONS.map((q) => {
    if (!askedIds.has(q.id)) {
      return { id: q.id, question: q.label, answer: null, reason: NO_DATA_REASON, points: NO_DATA_POINTS };
    }
    const a = byId.get(q.id);
    if (!a) return { id: q.id, question: q.label, answer: false, reason: NO_ANSWER_REASON, points: 0 };
    return { id: q.id, question: q.label, answer: a.answer, reason: a.reason, points: a.answer ? POINTS_PER_YES : 0 };
  });
}
