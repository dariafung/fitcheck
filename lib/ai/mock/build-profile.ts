import type { z } from "zod";
import {
  profileFacts,
  type BuildProfileInput,
  type BuildProfileOutput,
  type ProfileStatement,
  type ProfileTopic,
} from "../schemas/build-profile";
import type { FeelingAspect, ItemSummary } from "../schemas/common";

type Input = z.output<typeof BuildProfileInput>;
type Output = z.input<typeof BuildProfileOutput>;

// By rule, not at random, so the card only changes when the closet does:
// each topic takes the first feeling about it (by item order), else a line
// from the tags.
export function mockBuildProfile(input: Input): Output {
  const facts = profileFacts(input);
  const aspects = input.items.flatMap((item) => {
    const feeling = input.feelings.find((f) => f.itemId === item.id);
    return (feeling?.aspects ?? []).map((aspect) => ({ item, aspect }));
  });
  const fromFeeling = (topic: ProfileTopic, sentiment: FeelingAspect["sentiment"]): ProfileStatement | null => {
    const found = aspects.find(({ aspect }) => aspect.aspect === topic && aspect.sentiment === sentiment);
    return found ? { topic, text: sentence(found.aspect.means), evidenceItemIds: [found.item.id] } : null;
  };

  const suits: ProfileStatement[] = [];
  const avoid: ProfileStatement[] = [];
  for (const topic of facts.topics) {
    const good = topic === "occasion" ? occasionLine(input, facts) : (fromFeeling(topic, "positive") ?? tagLine(topic, input.items));
    if (good) suits.push(good);
    const bad = topic === "occasion" ? null : fromFeeling(topic, "negative");
    if (bad) avoid.push(bad as ProfileStatement & { topic: Exclude<ProfileTopic, "occasion"> });
  }
  if (suits.length === 0) suits.push({ topic: "style", text: "Pieces you already own.", evidenceItemIds: [input.items[0].id] });

  return {
    headline: {
      text: `${formalityWord(input.items)} pieces, mostly in ${topNames(input.items.flatMap((i) => i.tags.colors.map((c) => c.name)), 2)}.`,
      evidenceItemIds: input.items.slice(0, 2).map((i) => i.id),
    },
    suits,
    avoid: avoid as Output["avoid"],
  };
}

function tagLine(topic: ProfileTopic, items: readonly ItemSummary[]): ProfileStatement | null {
  if (topic === "color") {
    const colored = items.filter((i) => i.tags.colors.length > 0);
    if (colored.length === 0) return null;
    return { topic, text: `Mostly ${topNames(colored.flatMap((i) => i.tags.colors.map((c) => c.name)), 2)}.`, evidenceItemIds: ids(colored) };
  }
  if (topic === "feel") {
    const made = items.filter((i) => i.tags.materials.length > 0);
    if (made.length === 0) return null;
    return { topic, text: `Mostly ${topNames(made.flatMap((i) => i.tags.materials), 2)}.`, evidenceItemIds: ids(made) };
  }
  if (topic === "fit") {
    const fitted = items.filter((i) => i.tags.fit);
    if (fitted.length === 0) return null;
    return { topic, text: `Mostly ${topNames(fitted.map((i) => i.tags.fit ?? ""), 1)} cuts.`, evidenceItemIds: ids(fitted) };
  }
  if (topic === "style") return { topic, text: `${formalityWord(items)} pieces.`, evidenceItemIds: ids(items) };
  return null;
}

function occasionLine(input: Input, facts: ReturnType<typeof profileFacts>): ProfileStatement | null {
  const top = facts.occasions.slice(0, 3).map((c) => c.occasion);
  if (top.length === 0) return null;
  const items = input.items.filter((i) => i.tags.occasions.some((o) => top.includes(o)));
  return { topic: "occasion", text: `Mostly for ${joinWords(top)}.`, evidenceItemIds: ids(items.length > 0 ? items : input.items) };
}

function formalityWord(items: readonly ItemSummary[]): string {
  const average = items.reduce((sum, i) => sum + i.tags.formality, 0) / items.length;
  return average < 2.5 ? "Casual" : average < 3.5 ? "Smart casual" : "Dressy";
}

// The most common names first, ties in first-seen order.
function topNames(names: readonly string[], count: number): string {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name.toLowerCase(), (counts.get(name.toLowerCase()) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, count).map(([name]) => name);
  return top.length > 0 ? joinWords(top) : "mixed colors";
}

function joinWords(words: readonly string[]): string {
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

function sentence(text: string): string {
  const trimmed = text.trim().replace(/\.$/, "");
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}.`;
}

function ids(items: readonly ItemSummary[]): string[] {
  return items.map((i) => i.id);
}
