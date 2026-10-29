import type { z } from "zod";
import { releaseBudget, reserveBudget } from "./budget";
import type { AiFunctionDef } from "./define";
import { AiInputError, AiOutputError, AiReplayMissError } from "./errors";
import { inputHash, stableStringify } from "./hash";
import { currentMode, recordEnabled, type AiMode } from "./mode";
import { readReplay, writeReplay } from "./replay/store";

export interface RunOptions {
  mode?: AiMode;
  record?: boolean;
  replayDir?: string;
}

const PREVIEW_LENGTH = 300;
const DEFAULT_LIVE_ATTEMPTS = 2;

// Validate input, dispatch by mode, validate output. In live mode an output
// that fails validation is tried again, up to def.liveAttempts calls in all.
export async function runAi<I extends z.ZodType, O extends z.ZodType>(
  def: AiFunctionDef<I, O>,
  rawInput: unknown,
  options: RunOptions = {},
): Promise<z.output<O>> {
  const parsedInput = def.input.safeParse(rawInput);
  if (!parsedInput.success) {
    throw new AiInputError(def.name, parsedInput.error.issues);
  }
  const input = parsedInput.data;
  const mode = options.mode ?? currentMode();
  const hash = inputHash(def.name, def.promptVersion, input);

  if (mode === "mock") {
    return parseOutput(def, def.mock(input, hash));
  }

  if (mode === "replay") {
    const record = await readReplay(def.name, hash, options.replayDir);
    if (!record) throw new AiReplayMissError(def.name, hash);
    return parseOutput(def, record.output);
  }

  let result = await callLive(def, input);
  for (let attempt = 2; !result.success && attempt <= (def.liveAttempts ?? DEFAULT_LIVE_ATTEMPTS); attempt++) {
    result = await callLive(def, input);
  }
  if (!result.success) throw new AiOutputError(def.name, result.error.issues);

  if (options.record ?? recordEnabled()) {
    await writeReplay(
      {
        fn: def.name,
        promptVersion: def.promptVersion,
        inputHash: hash,
        inputPreview: stableStringify(input).slice(0, PREVIEW_LENGTH),
        output: result.data,
        recordedAt: new Date().toISOString(),
      },
      options.replayDir,
    );
  }
  return result.data;
}

async function callLive<I extends z.ZodType, O extends z.ZodType>(
  def: AiFunctionDef<I, O>,
  input: z.output<I>,
) {
  const hold = await reserveBudget(def.name);
  try {
    return def.output.safeParse(await def.live(input));
  } finally {
    await releaseBudget(hold);
  }
}

function parseOutput<I extends z.ZodType, O extends z.ZodType>(
  def: AiFunctionDef<I, O>,
  raw: unknown,
): z.output<O> {
  const result = def.output.safeParse(raw);
  if (!result.success) throw new AiOutputError(def.name, result.error.issues);
  return result.data;
}
