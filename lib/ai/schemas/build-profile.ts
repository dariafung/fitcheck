import { z } from "zod";
import { FeelingStructured, ItemSummary, Occasion, type FeelingAspectKind } from "./common";

export const PROMPT_VERSION = "build-profile@3";

// What a statement on the style card is about. The first five match feeling
// aspects; feel covers fabrics and how they feel.
export const ProfileTopic = z.enum(["color", "fit", "feel", "length", "style", "occasion"]);
export type ProfileTopic = z.infer<typeof ProfileTopic>;
export const PROFILE_TOPICS = ProfileTopic.options;

export const HEADLINE_MAX_WORDS = 20;
export const STATEMENT_MAX_WORDS = 15;

// The user's active items and the parsed feelings about them.
export const BuildProfileInput = z.object({
  items: z.array(ItemSummary).min(1),
  feelings: z.array(FeelingStructured.extend({ itemId: z.uuid() })).min(1),
});
export type BuildProfileInput = z.input<typeof BuildProfileInput>;

// Every statement must trace back to specific items; the card doesn't show
// them, but they keep the model honest and drop statements about items that
// later leave the closet.
const Evidence = z.array(z.uuid()).min(1);

export const ProfileStatement = z.object({
  topic: ProfileTopic,
  text: z.string().min(1),
  evidenceItemIds: Evidence,
});
export type ProfileStatement = z.infer<typeof ProfileStatement>;

// At most one statement per topic on each side; occasions are only ever
// summed up, never avoided.
export const BuildProfileOutput = z.object({
  headline: z.object({ text: z.string().min(1), evidenceItemIds: Evidence }),
  suits: z.array(ProfileStatement).min(1),
  avoid: z.array(ProfileStatement.extend({ topic: ProfileTopic.exclude(["occasion"]) })),
});
export type BuildProfileOutput = z.output<typeof BuildProfileOutput>;

export interface OccasionCount {
  occasion: Occasion;
  items: number;
  feelings: number;
}

export interface ProfileFacts {
  // Topics the closet gives something to go on; the card should cover each.
  topics: ProfileTopic[];
  // Counted here so the model only has to put them into words.
  occasions: OccasionCount[];
  // Some feeling is negative, so the card should say what to skip.
  needsAvoid: boolean;
}

const ASPECT_TOPICS: Record<Exclude<FeelingAspectKind, "other">, ProfileTopic> = {
  color: "color",
  fit: "fit",
  feel: "feel",
  length: "length",
  style: "style",
};

type Input = z.output<typeof BuildProfileInput>;

export function profileFacts(input: Input): ProfileFacts {
  const aspectTopics = new Set(
    input.feelings.flatMap((f) => f.aspects.flatMap((a) => (a.aspect === "other" ? [] : [ASPECT_TOPICS[a.aspect]]))),
  );
  const occasions = countOccasions(input);
  const has: Record<ProfileTopic, boolean> = {
    color: aspectTopics.has("color") || input.items.some((i) => i.tags.colors.length > 0 || i.tags.colorFamily),
    fit: aspectTopics.has("fit") || input.items.some((i) => i.tags.fit),
    feel: aspectTopics.has("feel") || input.items.some((i) => i.tags.materials.length > 0),
    length: aspectTopics.has("length"),
    // Every item has a formality.
    style: true,
    occasion: occasions.length > 0,
  };
  const needsAvoid = input.feelings.some(
    (f) => f.flattering === "no" || f.liked === "no" || f.aspects.some((a) => a.sentiment === "negative"),
  );
  return { topics: PROFILE_TOPICS.filter((t) => has[t]), occasions, needsAvoid };
}

// Items tagged for each occasion and feelings that mention it, most first.
function countOccasions(input: Input): OccasionCount[] {
  return Occasion.options
    .map((occasion) => ({
      occasion,
      items: input.items.filter((i) => i.tags.occasions.includes(occasion)).length,
      feelings: input.feelings.filter((f) => f.occasions.some((o) => o.trim().toLowerCase() === occasion)).length,
    }))
    .filter((c) => c.items + c.feelings > 0)
    .sort((a, b) => b.items + b.feelings - (a.items + a.feelings));
}
