// Page copy for the errors aiErrorResponse and requireWriter answer with.
// No server-only imports here: the client bundles this file.
import { DEMO_READ_ONLY, DEMO_READ_ONLY_ERROR } from "../auth/messages";

// The site's daily model budget is spent, for everyone: signed-up accounts
// and the demo alike.
export const AI_BUDGET_NOTICE = "Adding and checking are paused for today. You can still browse the closet.";
// One account, or the shared demo account, used up an action's daily count.
export const DAILY_LIMIT_NOTICE = "That's your AI limit for today. Try again tomorrow.";
export const DEMO_LIMIT_NOTICE = "The demo's AI is done for today. Sign up to keep going.";

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
  if (error === "AiDailyLimitError") return DAILY_LIMIT_NOTICE;
  if (error === "AiDemoLimitError") return DEMO_LIMIT_NOTICE;
  if (error === DEMO_READ_ONLY_ERROR) return DEMO_READ_ONLY;
  return undefined;
}
