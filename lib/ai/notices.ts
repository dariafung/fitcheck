// Page copy for the errors aiErrorResponse and requireWriter answer with.
// No server-only imports here: the client bundles this file.
import { DEMO_READ_ONLY, DEMO_READ_ONLY_ERROR } from "../auth/messages";

export const AI_BUDGET_NOTICE = "The demo's AI is resting for today. You can still browse the closet.";

// `error` names of a model that failed or isn't reachable (502 / 503).
const AI_FAILURES = new Set(["AiOutputError", "AiUpstreamError", "AiReplayMissError", "AiNotConfiguredError"]);

export function isAiFailure(error: string | undefined): boolean {
  return error !== undefined && AI_FAILURES.has(error);
}

// The notice every page shows for this `error`, or undefined to let the page
// use its own message. Matched by name, not status: a rate limit may answer
// 429 too.
export function aiNotice(error: string | undefined): string | undefined {
  if (error === "AiBudgetError") return AI_BUDGET_NOTICE;
  if (error === DEMO_READ_ONLY_ERROR) return DEMO_READ_ONLY;
  return undefined;
}
