import { describe, expect, it } from "vitest";
import {
  advance,
  afterReadFailure,
  isDone,
  MAX_SCREENSHOTS,
  queueLabel,
  queueSummary,
  remaining,
  startQueue,
  takeScreenshots,
  tooManyNote,
} from "./queue";

describe("takeScreenshots", () => {
  it("takes up to 10, in the order picked", () => {
    expect(MAX_SCREENSHOTS).toBe(10);
    expect(takeScreenshots([])).toEqual({ taken: [], leftOut: 0 });
    expect(takeScreenshots(["a", "b", "c"])).toEqual({ taken: ["a", "b", "c"], leftOut: 0 });
    const ten = Array.from({ length: 10 }, (_, i) => i);
    expect(takeScreenshots(ten)).toEqual({ taken: ten, leftOut: 0 });
  });

  it("leaves the rest out and says how many", () => {
    const picked = Array.from({ length: 13 }, (_, i) => i);
    const { taken, leftOut } = takeScreenshots(picked);
    expect(taken).toEqual(picked.slice(0, 10));
    expect(leftOut).toBe(3);
    expect(tooManyNote(leftOut)).toBe("That's more than 10. We took the first 10; add the other 3 after.");
  });
});

describe("the queue", () => {
  it("is only a queue from two screenshots up", () => {
    expect(startQueue(0)).toBeNull();
    expect(startQueue(1)).toBeNull();
    expect(startQueue(2)).toEqual({ total: 2, index: 0, added: 0, skipped: 0, failed: 0 });
  });

  it("goes through one at a time, counting how each ended", () => {
    let queue = startQueue(4)!;
    expect(queueLabel(queue)).toBe("1 of 4");
    expect(remaining(queue)).toBe(4);
    queue = advance(queue, "added");
    expect(queueLabel(queue)).toBe("2 of 4");
    queue = advance(queue, "failed");
    queue = advance(queue, "skipped");
    expect(queueLabel(queue)).toBe("4 of 4");
    expect(isDone(queue)).toBe(false);
    expect(remaining(queue)).toBe(1);
    queue = advance(queue, "added");
    expect(isDone(queue)).toBe(true);
    expect(remaining(queue)).toBe(0);
    expect(queue).toEqual({ total: 4, index: 4, added: 2, skipped: 1, failed: 1 });
    expect(queueSummary(queue)).toBe("2 added, 1 skipped, 1 couldn't be read.");
  });

  it("stays put once it's done", () => {
    const done = advance(advance(startQueue(2)!, "added"), "added");
    expect(advance(done, "failed")).toEqual(done);
    expect(queueLabel(done)).toBe("2 of 2");
  });

  it("sums up only what happened", () => {
    const queue = startQueue(3)!;
    expect(queueSummary({ ...queue, index: 3, added: 3 })).toBe("3 added.");
    expect(queueSummary({ ...queue, index: 3, skipped: 3 })).toBe("0 added, 3 skipped.");
    expect(queueSummary({ ...queue, index: 3, added: 2, failed: 1 })).toBe("2 added, 1 couldn't be read.");
  });
});

describe("afterReadFailure", () => {
  it("moves on when only this screenshot is the problem", () => {
    for (const error of ["unrecognized", "not_image", "too_large", "accessory", "AiUpstreamError", "AiOutputError", undefined]) {
      expect(afterReadFailure({ error }), String(error)).toBe("next");
    }
  });

  it("stops when no read will work again today", () => {
    for (const error of ["AiDailyLimitError", "AiDemoLimitError", "AiBudgetError"]) {
      expect(afterReadFailure({ error }), error).toBe("stop");
    }
  });

  it("waits when the request never got through", () => {
    expect(afterReadFailure({ offline: true })).toBe("pause");
  });
});
