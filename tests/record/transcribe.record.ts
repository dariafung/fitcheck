// Paid: sends fixtures/audio/feeling-en.wav (about 7 seconds, under $0.001)
// to the real Voice Transcribe once and records the answer under
// fixtures/ai/transcribe/. Skipped when already recorded; RERECORD=transcribe
// (or "all") records it again. Run by hand:
//   npx -y pnpm@12.15.0 exec vitest run --project record tests/record/transcribe.record.ts
// The transcript and cost go to test-results/ai-record.log.
import { appendFileSync, mkdirSync } from "node:fs";
import { expect, it } from "vitest";
import { transcribe } from "@/lib/ai";
import { MAX_COST_USD, spentTodayUsd } from "@/lib/ai/budget";
import { inputHash } from "@/lib/ai/hash";
import { readReplay } from "@/lib/ai/replay/store";
import { PROMPT_VERSION, TranscribeInput } from "@/lib/ai/schemas/transcribe";
import { VOICE_CASE } from "./voice-cases";

// One run never spends more than this.
const RUN_LIMIT_USD = 0.05;
const LOG = "test-results/ai-record.log";

mkdirSync("test-results", { recursive: true });
const log = (line: string) => appendFileSync(LOG, `${line}\n`);

it(`transcribe · ${VOICE_CASE.name}`, async () => {
  const list = (process.env.RERECORD ?? "").split(",");
  const hash = inputHash("transcribe", PROMPT_VERSION, TranscribeInput.parse(VOICE_CASE.input));
  if (!list.includes("all") && !list.includes("transcribe") && (await readReplay("transcribe", hash))) {
    log(`transcribe · ${VOICE_CASE.name} · already recorded, skipped`);
    return;
  }
  if (spentTodayUsd() + MAX_COST_USD.transcribe > RUN_LIMIT_USD) {
    throw new Error(`Stopped: run limit $${RUN_LIMIT_USD} could be passed`);
  }
  const started = Date.now();
  const output = await transcribe(VOICE_CASE.input, { mode: "live", record: true });
  log(
    `\n=== ${new Date().toISOString()}\ntranscribe · ${VOICE_CASE.name} · ok · ${Date.now() - started} ms` +
      ` · run total $${spentTodayUsd().toFixed(5)}\n${JSON.stringify(output, null, 2)}`,
  );
  expect(output.text.length).toBeGreaterThan(0);
});
