// Several screenshots picked at once on the add page: they are read one
// after another, never in parallel, and each still gets its card to confirm
// or skip. This is only the bookkeeping; the page holds the files.
// No server-only imports here: the client bundles this file.
import { aiNotice } from "../ai/notices";

export const MAX_SCREENSHOTS = 10;

// The first MAX_SCREENSHOTS of what was picked, and how many were left out.
export function takeScreenshots<T>(picked: readonly T[]): { taken: T[]; leftOut: number } {
  const taken = picked.slice(0, MAX_SCREENSHOTS);
  return { taken, leftOut: picked.length - taken.length };
}

export function tooManyNote(leftOut: number): string {
  return `That's more than ${MAX_SCREENSHOTS}. We took the first ${MAX_SCREENSHOTS}; add the other ${leftOut} after.`;
}

export interface Queue {
  total: number;
  // The screenshot being read or confirmed, from 0; `total` once all are done.
  index: number;
  added: number;
  skipped: number;
  failed: number;
}

// One screenshot is not a queue: the page behaves as it always did.
export function startQueue(total: number): Queue | null {
  return total > 1 ? { total, index: 0, added: 0, skipped: 0, failed: 0 } : null;
}

export type QueueOutcome = "added" | "skipped" | "failed";

// On to the next screenshot, counting how this one ended.
export function advance(queue: Queue, outcome: QueueOutcome): Queue {
  if (isDone(queue)) return queue;
  return { ...queue, index: queue.index + 1, [outcome]: queue[outcome] + 1 };
}

export function isDone(queue: Queue): boolean {
  return queue.index >= queue.total;
}

export function remaining(queue: Queue): number {
  return Math.max(0, queue.total - queue.index);
}

// "2 of 6"
export function queueLabel(queue: Queue): string {
  return `${Math.min(queue.index + 1, queue.total)} of ${queue.total}`;
}

// What a screenshot that couldn't be read does to the rest:
// - "stop": no read will work again today (daily limit, the day's budget, a
//   read-only account); the queue ends with that message.
// - "pause": the request never got through; the queue waits where it is.
// - "next": only this screenshot is the problem; note it and move on.
export type AfterFailure = "stop" | "pause" | "next";

export function afterReadFailure(failure: { offline: true } | { error: string | undefined }): AfterFailure {
  if ("offline" in failure) return "pause";
  return aiNotice(failure.error) ? "stop" : "next";
}

// One line once every screenshot has been dealt with: "4 added, 1 skipped,
// 1 couldn't be read."
export function queueSummary(queue: Queue): string {
  const parts = [`${queue.added} added`];
  if (queue.skipped > 0) parts.push(`${queue.skipped} skipped`);
  if (queue.failed > 0) parts.push(`${queue.failed} couldn't be read`);
  return `${parts.join(", ")}.`;
}
