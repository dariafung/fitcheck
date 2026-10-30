// Paid: sends the cases in cases.ts to the real model and records the answers
// under fixtures/ai/. Cases that already have a recording are skipped; set
// RERECORD=parseFeeling,judgePairing,judgeRepeat,scorePurchase,buildProfile (or "all") to record them again. Run by
// hand, within the day's budget:
//   npx -y pnpm@12.15.0 exec vitest run --project record
// Token counts, cost and raw answers go to test-results/ai-record.log.
import { appendFileSync, mkdirSync } from "node:fs";
import type { Response } from "openai/resources/responses/responses";
import { describe, expect, it, vi } from "vitest";
import { buildProfile, judgePairing, judgeRepeat, parseFeeling, scorePurchase } from "@/lib/ai";
import { costUsd, MAX_COST_USD, memoryBudgetStore, setBudgetStore, spentTodayUsd } from "@/lib/ai/budget";
import type { AiFunctionName } from "@/lib/ai/define";
import { inputHash } from "@/lib/ai/hash";
import { getClient } from "@/lib/ai/live/client";
import { outputText } from "@/lib/ai/live/respond";
import { readReplay } from "@/lib/ai/replay/store";
import { BuildProfileInput, PROMPT_VERSION as PROFILE_VERSION } from "@/lib/ai/schemas/build-profile";
import { PROMPT_VERSION as FEELING_VERSION, ParseFeelingInput } from "@/lib/ai/schemas/parse-feeling";
import { PROMPT_VERSION as PAIRING_VERSION, JudgePairingInput } from "@/lib/ai/schemas/judge-pairing";
import { PROMPT_VERSION as REPEAT_VERSION, JudgeRepeatInput } from "@/lib/ai/schemas/judge-repeat";
import { PROMPT_VERSION as SCORE_VERSION, ScorePurchaseInput } from "@/lib/ai/schemas/score-purchase";
import { FEELING_CASES, PAIRING_CASES, PROFILE_CASES, REPEAT_CASES, SCORE_CASES } from "./cases";

// One run never spends more than this, whatever the daily budget says.
const RUN_LIMIT_USD = 0.45;
const LIVE = { mode: "live", record: true } as const;
const LOG = "test-results/ai-record.log";

// Counted in memory, as one run: spentTodayUsd() below is this run's total.
setBudgetStore(memoryBudgetStore());

mkdirSync("test-results", { recursive: true });
const log = (line: string) => appendFileSync(LOG, `${line}\n`);
log(`\n=== ${new Date().toISOString()}`);

function rerecord(fn: AiFunctionName): boolean {
  const list = (process.env.RERECORD ?? "").split(",");
  return list.includes("all") || list.includes(fn);
}

async function recorded<T>(
  fn: AiFunctionName,
  name: string,
  hash: string,
  run: () => Promise<T>,
): Promise<T | null> {
  if (!rerecord(fn) && (await readReplay(fn, hash))) {
    log(`${fn} · ${name} · already recorded, skipped`);
    return null;
  }
  if ((await spentTodayUsd()) + MAX_COST_USD[fn] > RUN_LIMIT_USD) {
    throw new Error(`Stopped before "${name}": run limit $${RUN_LIMIT_USD} could be passed`);
  }
  const client = await getClient(fn);
  const create = vi.spyOn(client.responses, "create");
  const started = Date.now();
  try {
    const output = await run();
    log(`${fn} · ${name} · ok\n${JSON.stringify(output, null, 2)}`);
    return output;
  } finally {
    for (const result of create.mock.results) {
      if (result.type !== "return") continue;
      const response = (await (result.value as Promise<Response>).catch(() => null)) as Response | null;
      if (!response) continue;
      const u = response.usage;
      log(
        `  call · status ${response.status} ${JSON.stringify(response.incomplete_details ?? null)}` +
          ` · in ${u?.input_tokens} (cached ${u?.input_tokens_details?.cached_tokens ?? 0})` +
          ` · out ${u?.output_tokens} (reasoning ${u?.output_tokens_details?.reasoning_tokens ?? 0})` +
          ` · $${costUsd(u).toFixed(4)}\n  text: ${outputText(response).slice(0, 2000)}`,
      );
    }
    log(
      `  ${fn} · ${name} · ${create.mock.calls.length} call(s) · ${Date.now() - started} ms` +
        ` · run total $${(await spentTodayUsd()).toFixed(4)}`,
    );
  }
}

describe("parseFeeling", () => {
  for (const { name, input } of FEELING_CASES) {
    it(name, async () => {
      const hash = inputHash("parseFeeling", FEELING_VERSION, ParseFeelingInput.parse(input));
      const output = await recorded("parseFeeling", name, hash, () => parseFeeling(input, LIVE));
      if (output) expect(output.summary.length).toBeGreaterThan(0);
    });
  }
});

describe("judgePairing", () => {
  for (const { name, input } of PAIRING_CASES) {
    it(name, async () => {
      const hash = inputHash("judgePairing", PAIRING_VERSION, JudgePairingInput.parse(input));
      const output = await recorded("judgePairing", name, hash, () => judgePairing(input, LIVE));
      if (output) expect(output.results.length).toBeGreaterThan(0);
    });
  }
});

describe("judgeRepeat", () => {
  for (const { name, input } of REPEAT_CASES) {
    it(name, async () => {
      const hash = inputHash("judgeRepeat", REPEAT_VERSION, JudgeRepeatInput.parse(input));
      const output = await recorded("judgeRepeat", name, hash, () => judgeRepeat(input, LIVE));
      if (output) expect(output.reason.length).toBeGreaterThan(0);
    });
  }
});

describe("scorePurchase", () => {
  for (const { name, input } of SCORE_CASES) {
    it(name, async () => {
      const hash = inputHash("scorePurchase", SCORE_VERSION, ScorePurchaseInput.parse(input));
      const output = await recorded("scorePurchase", name, hash, () => scorePurchase(input, LIVE));
      if (output) expect(output.answers.length).toBeGreaterThan(0);
    });
  }
});

describe("buildProfile", () => {
  for (const { name, input } of PROFILE_CASES) {
    it(name, async () => {
      const hash = inputHash("buildProfile", PROFILE_VERSION, BuildProfileInput.parse(input));
      const output = await recorded("buildProfile", name, hash, () => buildProfile(input, LIVE));
      if (output) expect(output.suits.length).toBeGreaterThan(0);
    });
  }
});
