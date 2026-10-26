import type { AiFunctionName } from "./define";

// TODO(P0-7): daily budget counter and per-IP rate limit. Throw to refuse a
// live call. Runs before every live attempt, including the retry.
export async function checkBudget(fn: AiFunctionName): Promise<void> {
  void fn;
}
