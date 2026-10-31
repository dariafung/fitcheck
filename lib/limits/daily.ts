// Per-caller daily limits on AI actions, so one account can't spend the
// whole day's budget; the app-wide daily budget (lib/ai/budget.ts) stays the
// last guard. Route Handlers take one count per action right before the
// model call and give it back when the action failed on our side. Only on
// with sign-in on (the hosted site): local dev and the default e2e run are
// the persona with no limits.
import { dailyBudgetUsd, spentTodayUsd, today } from "@/lib/ai/budget";
import { AiBudgetError, AiDailyLimitError, AiDemoLimitError, AiError } from "@/lib/ai/errors";
import { currentMode } from "@/lib/ai/mode";
import { authRequired } from "@/lib/auth/config";
import { sessionUser } from "@/lib/auth/session";
import { DAILY_LIMITS, DEMO_DAILY_LIMITS, DEMO_RESERVE_USD, SIGNUPS_PER_IP_PER_DAY, type DailyAction } from "./limits";
import { usageStore } from "./usage-store";

export { DAILY_LIMITS, DEMO_DAILY_LIMITS, DEMO_RESERVE_USD, SIGNUPS_PER_IP_PER_DAY, type DailyAction };

export interface DailyTicket {
  // Gives the count back; safe to call more than once.
  giveBack(): Promise<void>;
}

const UNLIMITED: DailyTicket = { async giveBack() {} };

// Chicago's UTC offset in minutes at `at`, e.g. -300 for CDT.
function chicagoOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

// Seconds until the next Chicago midnight, when counts reset.
export function secondsUntilTomorrow(now = new Date()): number {
  const [y, m, d] = today(now).split("-").map(Number);
  const wallMidnight = Date.UTC(y, m - 1, d + 1);
  // The offset at midnight itself, which differs from now's on DST days.
  let at = wallMidnight - chicagoOffsetMinutes(new Date(wallMidnight)) * 60_000;
  at = wallMidnight - chicagoOffsetMinutes(new Date(at)) * 60_000;
  return Math.max(1, Math.ceil((at - now.getTime()) / 1000));
}

interface Hold {
  subject: string;
  limit: number;
}

// Takes every hold or none.
async function takeAll(holds: Hold[], day: string, action: string, over: () => Error): Promise<DailyTicket> {
  const counts = usageStore();
  const taken: string[] = [];
  for (const { subject, limit } of holds) {
    if (!(await counts.take(subject, day, action, limit))) {
      await Promise.all(taken.map((s) => counts.giveBack(s, day, action)));
      throw over();
    }
    taken.push(subject);
  }
  let given = false;
  return {
    async giveBack() {
      if (given) return;
      given = true;
      await Promise.all(taken.map((s) => counts.giveBack(s, day, action)));
    },
  };
}

// Takes one count of `action` for the current caller. Throws
// AiDailyLimitError (AiDemoLimitError for the demo account) when it's used
// up, or AiBudgetError when another account would dip into the demo's
// reserve. Signed out there is no one to count; the route refuses anyway.
export async function takeDaily(action: DailyAction, now = new Date()): Promise<DailyTicket> {
  if (!authRequired()) return UNLIMITED;
  const user = await sessionUser();
  if (!user) return UNLIMITED;
  const day = today(now);
  const limit = DAILY_LIMITS[action];

  if (!user.readOnly) {
    // Like the budget itself, only live calls spend anything.
    if (currentMode() === "live" && (await spentTodayUsd()) >= dailyBudgetUsd() - DEMO_RESERVE_USD) {
      throw new AiBudgetError(action);
    }
    return takeAll([{ subject: `user:${user.id}`, limit }], day, action, () => {
      return new AiDailyLimitError(action, secondsUntilTomorrow(now));
    });
  }

  const holds: Hold[] = [{ subject: `demo-session:${user.sessionId ?? "none"}`, limit }];
  const total = DEMO_DAILY_LIMITS[action];
  if (total !== undefined) holds.push({ subject: "demo", limit: total });
  return takeAll(holds, day, action, () => new AiDemoLimitError(action, secondsUntilTomorrow(now)));
}

// takeDaily for actions that quietly skip the model instead of saying so:
// null when the count is used up or the budget is closed to this caller.
export async function tryTakeDaily(action: DailyAction, now = new Date()): Promise<DailyTicket | null> {
  try {
    return await takeDaily(action, now);
  } catch (err) {
    if (err instanceof AiDailyLimitError || err instanceof AiBudgetError) return null;
    throw err;
  }
}

export interface GiveBackWhen<T> {
  // A result the model wasn't really used for.
  result?: (result: T) => boolean;
  // A failure on our side; default: any AiError.
  error?: (err: unknown) => boolean;
}

// Runs one counted action: takes the count, runs it, and gives the count
// back when it failed on our side (the model failed, the budget ran out).
export async function withDaily<T>(action: DailyAction, run: () => Promise<T>, when: GiveBackWhen<T> = {}): Promise<T> {
  const ticket = await takeDaily(action);
  let result: T;
  try {
    result = await run();
  } catch (err) {
    if ((when.error ?? isAiError)(err)) await ticket.giveBack();
    throw err;
  }
  if (when.result?.(result)) await ticket.giveBack();
  return result;
}

function isAiError(err: unknown): boolean {
  return err instanceof AiError;
}

class TooManySignups extends Error {}

// One sign-up from this (hashed) IP, or null when it made too many today.
export async function takeSignup(ipHash: string, now = new Date()): Promise<DailyTicket | null> {
  const holds = [{ subject: `signup-ip:${ipHash}`, limit: SIGNUPS_PER_IP_PER_DAY }];
  try {
    return await takeAll(holds, today(now), "signup", () => new TooManySignups());
  } catch (err) {
    if (err instanceof TooManySignups) return null;
    throw err;
  }
}
