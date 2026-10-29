import type { z } from "zod";
import { runAi, type RunOptions } from "./run";

export type AiFunctionName =
  | "extractItem"
  | "parseFeeling"
  | "transcribe"
  | "judgePairing"
  | "judgeRepeat"
  | "scorePurchase"
  | "renderOutfit"
  | "buildProfile"
  | "segmentGarment";

export interface AiFunctionDef<I extends z.ZodType, O extends z.ZodType> {
  name: AiFunctionName;
  promptVersion: string;
  input: I;
  output: O;
  // `seed` is the input hash, so the same input always gets the same mock.
  mock: (input: z.output<I>, seed: string) => z.input<O>;
  live: (input: z.output<I>) => Promise<unknown>;
  // Live calls in all when the output fails validation; default 2.
  liveAttempts?: number;
}

export type AiFunction<I extends z.ZodType, O extends z.ZodType> = ((
  input: z.input<I>,
  options?: RunOptions,
) => Promise<z.output<O>>) & { def: AiFunctionDef<I, O> };

export function defineAiFunction<I extends z.ZodType, O extends z.ZodType>(
  def: AiFunctionDef<I, O>,
): AiFunction<I, O> {
  const fn = (input: z.input<I>, options?: RunOptions) =>
    runAi(def, input, options);
  return Object.assign(fn, { def });
}
