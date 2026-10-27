import { z } from "zod";
import { FeelingStructured, ItemSummary } from "./common";

export const PROMPT_VERSION = "parse-feeling@2";

export const ParseFeelingInput = z.object({
  text: z.string().min(1).max(4000),
  item: ItemSummary,
});
export type ParseFeelingInput = z.input<typeof ParseFeelingInput>;

export const ParseFeelingOutput = FeelingStructured;
export type ParseFeelingOutput = z.output<typeof ParseFeelingOutput>;
