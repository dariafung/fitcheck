import type { z } from "zod";
import type {
  BuildProfileInput,
  BuildProfileOutput,
} from "../schemas/build-profile";

export function mockBuildProfile(
  input: z.output<typeof BuildProfileInput>,
): z.input<typeof BuildProfileOutput> {
  const first = input.items[0];
  const occasions = [...new Set(input.items.flatMap((i) => i.tags.occasions))];
  return {
    suits: [{ text: `Pieces like ${first.title}.`, evidenceItemIds: [first.id] }],
    avoid: [],
    frequentOccasions: occasions,
  };
}
