// Batching and caching around judgePairing. The model function is passed in
// by the Route Handler, so this module never imports the AI layer itself.
import type { JudgePairingInput, JudgePairingOutput } from "../ai/schemas/judge-pairing";
import { MAX_PAIRS_PER_CALL, PROMPT_VERSION } from "../ai/schemas/judge-pairing";
import { orderPair, pairKey, type ClosetItem } from "./types";

export type JudgeFn = (input: JudgePairingInput) => Promise<JudgePairingOutput>;

export interface PairVerdict {
  // Ordered: aId < bId, as stored in the pairings table.
  aId: string;
  bId: string;
  pairs: boolean;
  reason: string;
}

// The pairings columns this module reads.
export interface CachedPairing {
  item_a_id: string;
  item_b_id: string;
  pairs: boolean;
  reason: string | null;
  source: string;
  prompt_version: string | null;
  created_at: string;
}

// A cached AI verdict is reused only for the current prompt and only if it
// was made after both items last changed (e.g. the user edited a tag).
export function isFresh(
  row: CachedPairing,
  items: ReadonlyMap<string, ClosetItem>,
  promptVersion = PROMPT_VERSION,
): boolean {
  if (row.source !== "ai" || row.prompt_version !== promptVersion) return false;
  const judgedAt = Date.parse(row.created_at);
  return [row.item_a_id, row.item_b_id].every((id) => {
    const item = items.get(id);
    if (!item) return false;
    return !item.updatedAt || Date.parse(item.updatedAt) <= judgedAt;
  });
}

export function chunk<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function summary(item: ClosetItem) {
  return { id: item.id, title: item.title, tags: item.tags };
}

export interface JudgeResult {
  verdicts: Map<string, PairVerdict>;
  calls: number;
  // Pairs the model left out of its answer; not cached, asked again next time.
  missing: number;
}

// Asks the model in batches of MAX_PAIRS_PER_CALL, one call at a time.
// `onBatch` runs after each call so finished batches are cached even if a
// later call fails.
export async function judgeInBatches(
  pairs: readonly [ClosetItem, ClosetItem][],
  judge: JudgeFn,
  onBatch?: (verdicts: PairVerdict[]) => Promise<void>,
): Promise<JudgeResult> {
  const verdicts = new Map<string, PairVerdict>();
  let calls = 0;
  let missing = 0;
  for (const batch of chunk(pairs, MAX_PAIRS_PER_CALL)) {
    const output = await judge({
      pairs: batch.map(([a, b]) => ({ a: summary(a), b: summary(b) })),
    });
    calls += 1;
    const answered = new Map(
      output.results.map((r) => [pairKey(r.aId, r.bId), r]),
    );
    const fresh: PairVerdict[] = [];
    for (const [a, b] of batch) {
      const result = answered.get(pairKey(a.id, b.id));
      if (!result) {
        missing += 1;
        continue;
      }
      const [aId, bId] = orderPair(a.id, b.id);
      const verdict = { aId, bId, pairs: result.pairs, reason: result.reason };
      verdicts.set(pairKey(aId, bId), verdict);
      fresh.push(verdict);
    }
    if (onBatch && fresh.length > 0) await onBatch(fresh);
  }
  return { verdicts, calls, missing };
}
