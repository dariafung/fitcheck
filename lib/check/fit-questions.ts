// "Suits you": fixed yes/no questions for the model, asked against the items
// the user said flatter them or that they like. "Yes" is always the good
// answer; the model never scores.
import type { FeelingStructured, ItemSummary } from "../ai/schemas/common";
import type { Anchor, ScorePurchaseOutput } from "../ai/schemas/score-purchase";
import { NO_DATA_POINTS, POINTS_PER_YES } from "./score";
import { categoryOf, type ClosetItem } from "./types";

// Most anchors sent per check; same category first, then by id.
export const MAX_ANCHORS = 10;

// What a question compares against; with none of it, the question isn't asked.
type Basis = "flattering" | "liked" | "troubleAreas";

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
    text: "Is its cut and fit like the anchors the user marked as flattering?",
    label: "Cut like the ones that flatter you",
    basis: "flattering",
  },
  {
    id: "spares_trouble_areas",
    text: "Does it avoid drawing attention to the body areas listed in troubleAreas?",
    label: "Easy on the spots you're unsure about",
    basis: "troubleAreas",
  },
  {
    id: "color_liked",
    text: "Is its color within the range of colors of the anchors the user likes?",
    label: "A color you like",
    basis: "liked",
  },
  {
    id: "style_liked",
    text: "Is its style (formality, pattern, kind of piece) in line with the anchors the user likes?",
    label: "Your kind of style",
    basis: "liked",
  },
  {
    id: "feel_liked",
    text: "Would its material and feel likely suit how the user describes the anchors they like?",
    label: "Feels like your favorites",
    basis: "liked",
  },
];

export const NO_DATA_REASON = "Not enough to go on yet.";
export const NO_ANSWER_REASON = "No answer this time.";

export interface FeelingAnchor {
  item: ClosetItem;
  feeling: FeelingStructured;
}

const flatters = (f: FeelingStructured) => f.flattering === "yes";
const liked = (f: FeelingStructured) => f.liked === "yes";

// Owned items whose feeling says flattering or liked.
export function pickAnchors(
  closet: readonly ClosetItem[],
  feelings: ReadonlyMap<string, FeelingStructured>,
  candidate: ClosetItem,
): FeelingAnchor[] {
  const sameCategory = (item: ClosetItem) => (categoryOf(item) === categoryOf(candidate) ? 0 : 1);
  return closet
    .flatMap((item) => {
      const feeling = feelings.get(item.id);
      return feeling && (flatters(feeling) || liked(feeling)) ? [{ item, feeling }] : [];
    })
    .sort(
      (a, b) =>
        sameCategory(a.item) - sameCategory(b.item) ||
        (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0),
    )
    .slice(0, MAX_ANCHORS);
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

export function hasBasis(basis: Basis, anchors: readonly FeelingAnchor[], trouble: readonly string[]) {
  if (basis === "troubleAreas") return trouble.length > 0;
  return anchors.some(({ feeling }) => (basis === "flattering" ? flatters(feeling) : liked(feeling)));
}

export function toItemSummary(item: ClosetItem): ItemSummary {
  return { id: item.id, title: item.title, tags: item.tags };
}

export function toAnchor({ item, feeling }: FeelingAnchor): Anchor {
  return {
    ...toItemSummary(item),
    flattering: flatters(feeling),
    liked: liked(feeling),
    feeling: { aspects: feeling.aspects, mood: feeling.mood, summary: feeling.summary },
  };
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
