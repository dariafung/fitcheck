import type { z } from "zod";
import { MAX_INSIGHTS, type SummarizeWearInput, type SummarizeWearOutput } from "../schemas/summarize-wear";

type Input = z.output<typeof SummarizeWearInput>;
type Item = Input["items"][number];
type Insight = z.input<typeof SummarizeWearOutput>["insights"][number];

const times = (n: number) => (n === 1 ? "once" : `${n} times`);
const praised = (i: Item) => i.feeling?.liked === "yes" || i.feeling?.flattering === "yes";
const knocked = (i: Item) =>
  i.feeling?.liked === "no" || i.feeling?.flattering === "no" || !!i.feeling?.aspects.some((a) => a.sentiment === "negative");

// By rule, not at random, so e2e tests can look for the text: a praised
// piece worn least, a knocked piece worn most, a piece not worn at all, then
// the most worn piece. Each item at most once.
export function mockSummarizeWear(input: Input): z.input<typeof SummarizeWearOutput> {
  const byCount = [...input.items].sort((a, b) => a.wornCount - b.wornCount);
  const used = new Set<string>();
  const insights: Insight[] = [];
  const add = (item: Item | undefined, kind: Insight["kind"], text: (i: Item) => string) => {
    if (!item || used.has(item.id) || insights.length >= MAX_INSIGHTS) return;
    used.add(item.id);
    insights.push({ kind, text: `Mock: ${text(item)}`, itemIds: [item.id] });
  };

  add(byCount.find((i) => praised(i) && i.wornCount <= 1), "say_vs_wear", (i) => `you love the ${i.title} but wore it ${times(i.wornCount)}.`);
  add(byCount.findLast((i) => knocked(i) && i.wornCount >= 4), "say_vs_wear", (i) => `you knock the ${i.title} but wore it ${times(i.wornCount)}.`);
  add(byCount.find((i) => i.wornCount === 0 && i.addedDaysAgo === null && !used.has(i.id)), "idle", (i) => `the ${i.title} sat out all ${input.windowDays} days.`);
  add(byCount.findLast((i) => i.wornCount > 0), "favorite", (i) => `the ${i.title} is your go-to: ${times(i.wornCount)}.`);
  if (insights.length === 0) {
    insights.push({ kind: "pattern", text: `Mock: ${input.outfitCount} outfits logged.`, itemIds: [input.items[0].id] });
  }
  return { insights };
}
