import { describe, expect, it, vi } from "vitest";
import { judgePairing } from "../ai";
import { MAX_PAIRS_PER_CALL, PROMPT_VERSION } from "../ai/schemas/judge-pairing";
import { SAMPLE_CLOSET } from "./fixtures";
import {
  chunk,
  isFresh,
  judgeInBatches,
  type CachedPairing,
  type JudgeFn,
  type PairVerdict,
} from "./judge";
import { orderPair, type ClosetItem } from "./types";

const items = SAMPLE_CLOSET;
// More pairs than two calls can hold.
const PAIRS: [ClosetItem, ClosetItem][] = items
  .flatMap((a, i) => items.slice(i + 1).map((b) => [a, b] as [ClosetItem, ClosetItem]))
  .slice(0, MAX_PAIRS_PER_CALL * 2 + 5);

describe("chunk", () => {
  it("splits into full batches plus the remainder", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});

describe("judgeInBatches", () => {
  it("asks in batches of MAX_PAIRS_PER_CALL and caches after each one", async () => {
    const judge = vi.fn<JudgeFn>((input) => judgePairing(input));
    const onBatch = vi.fn(async (batch: PairVerdict[]) => void batch);
    const result = await judgeInBatches(PAIRS, judge, onBatch);

    expect(judge.mock.calls.map(([input]) => input.pairs.length)).toEqual([
      MAX_PAIRS_PER_CALL, MAX_PAIRS_PER_CALL, 5,
    ]);
    expect(result.calls).toBe(3);
    expect(result.verdicts.size).toBe(PAIRS.length);
    expect(onBatch.mock.calls.map(([batch]) => batch.length)).toEqual([
      MAX_PAIRS_PER_CALL, MAX_PAIRS_PER_CALL, 5,
    ]);
  });

  it("stores verdicts with ordered ids, whatever order the model used", async () => {
    const [a, b] = PAIRS[0];
    const judge: JudgeFn = async () => ({
      results: [{ aId: b.id, bId: a.id, pairs: true, reason: "ok" }],
    });
    const { verdicts } = await judgeInBatches([[a, b]], judge);
    const [lo, hi] = orderPair(a.id, b.id);
    expect([...verdicts.values()]).toEqual([{ aId: lo, bId: hi, pairs: true, reason: "ok" }]);
  });

  it("leaves out pairs the model skipped and ignores pairs it wasn't asked", async () => {
    const [a, b, c, d] = items;
    const judge: JudgeFn = async () => ({
      results: [
        { aId: a.id, bId: b.id, pairs: false, reason: "no" },
        { aId: a.id, bId: d.id, pairs: true, reason: "not asked" },
      ],
    });
    const result = await judgeInBatches([[a, b], [c, d]], judge);
    expect(result.missing).toBe(1);
    expect([...result.verdicts.values()].map((v) => v.pairs)).toEqual([false]);
  });

  it("keeps finished batches when a later call fails", async () => {
    const saved: number[] = [];
    let call = 0;
    const judge: JudgeFn = async (input) => {
      call += 1;
      if (call === 2) throw new Error("model down");
      return judgePairing(input);
    };
    await expect(
      judgeInBatches(PAIRS, judge, async (batch) => {
        saved.push(batch.length);
      }),
    ).rejects.toThrow("model down");
    expect(saved).toEqual([MAX_PAIRS_PER_CALL]);
  });

  it("makes no call when there is nothing to judge", async () => {
    const judge = vi.fn<JudgeFn>();
    expect(await judgeInBatches([], judge)).toMatchObject({ calls: 0, missing: 0 });
    expect(judge).not.toHaveBeenCalled();
  });
});

describe("isFresh", () => {
  const [a, b] = PAIRS[0];
  const at = (iso: string, item: ClosetItem) => ({ ...item, updatedAt: iso });
  const byId = (...list: ClosetItem[]) => new Map(list.map((i) => [i.id, i]));
  const row = (over: Partial<CachedPairing> = {}): CachedPairing => {
    const [lo, hi] = orderPair(a.id, b.id);
    return {
      item_a_id: lo, item_b_id: hi, pairs: true, reason: "ok", source: "ai",
      prompt_version: PROMPT_VERSION, created_at: "2026-10-26T12:00:00Z", ...over,
    };
  };
  const before = "2026-10-26T11:00:00Z";
  const after = "2026-10-26T13:00:00Z";

  it("reuses a verdict made after both items last changed", () => {
    expect(isFresh(row(), byId(at(before, a), at(before, b)))).toBe(true);
    expect(isFresh(row(), byId(a, b))).toBe(true);
  });

  it("drops it when either item changed since", () => {
    expect(isFresh(row(), byId(at(after, a), at(before, b)))).toBe(false);
    expect(isFresh(row(), byId(at(before, a), at(after, b)))).toBe(false);
  });

  it("drops it for another prompt version, a rule row or an unknown item", () => {
    expect(isFresh(row({ prompt_version: "judge-pairing@0" }), byId(a, b))).toBe(false);
    expect(isFresh(row({ source: "rule" }), byId(a, b))).toBe(false);
    expect(isFresh(row(), byId(a))).toBe(false);
  });
});
