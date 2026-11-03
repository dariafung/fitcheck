import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DAILY_BUDGET_USD, memoryBudgetStore, recordSpend, setBudgetStore } from "@/lib/ai/budget";
import { AiBudgetError, AiDailyLimitError, AiDemoLimitError, AiOutputError } from "@/lib/ai/errors";
import { aiErrorResponse } from "@/lib/ai/http";
import type { SessionUser } from "@/lib/auth/session";
import {
  DAILY_LIMITS,
  DEMO_DAILY_LIMITS,
  DEMO_RESERVE_USD,
  secondsUntilTomorrow,
  SIGNUPS_PER_IP_PER_DAY,
  takeDaily,
  takeSignup,
  tryTakeDaily,
  withDaily,
} from "./daily";
import { memoryUsageStore, setUsageStore, type UsageStore } from "./usage-store";

const session = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock("@/lib/auth/session", () => ({ sessionUser: async () => session.user }));

const NOON = new Date("2026-10-31T17:00:00Z"); // 12:00 in Chicago
const user = (id: string): SessionUser => ({ id, email: `${id}@example.com`, name: null, readOnly: false, sessionId: `s-${id}` });
const demo = (sessionId: string | null): SessionUser => ({ id: "demo", email: null, name: null, readOnly: true, sessionId });

async function takeTimes(n: number, action: Parameters<typeof takeDaily>[0], now = NOON) {
  for (let i = 0; i < n; i++) await takeDaily(action, now);
}

let store: UsageStore;

beforeEach(() => {
  vi.stubEnv("AUTH_REQUIRED", "1");
  vi.stubEnv("AI_MODE", "mock");
  vi.stubEnv("AI_DAILY_BUDGET_USD", "");
  store = memoryUsageStore();
  setUsageStore(store);
  setBudgetStore(memoryBudgetStore());
  session.user = user("a");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("takeDaily", () => {
  it("counts nothing with sign-in off", async () => {
    vi.stubEnv("AUTH_REQUIRED", "");
    await expect(takeTimes(DAILY_LIMITS.check + 5, "check")).resolves.toBeUndefined();
  });

  it("stops an account at its daily limit, until 429 says when", async () => {
    await takeTimes(DAILY_LIMITS.check, "check");
    const err = await takeDaily("check", NOON).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiDailyLimitError);
    expect(err).not.toBeInstanceOf(AiDemoLimitError);
    expect((err as AiDailyLimitError).name).toBe("AiDailyLimitError");
    expect((err as AiDailyLimitError).retryAfterSeconds).toBe(12 * 3600);
  });

  it("keeps accounts, actions and days apart", async () => {
    await takeTimes(DAILY_LIMITS.check, "check");
    await expect(takeDaily("style", NOON)).resolves.toBeDefined();
    await expect(takeDaily("check", new Date("2026-11-01T17:00:00Z"))).resolves.toBeDefined();
    session.user = user("b");
    await expect(takeDaily("check", NOON)).resolves.toBeDefined();
  });

  it("gives each demo login its own count", async () => {
    session.user = demo("one");
    await takeTimes(DAILY_LIMITS.check, "check");
    await expect(takeDaily("check", NOON)).rejects.toBeInstanceOf(AiDemoLimitError);
    session.user = demo("two");
    await expect(takeDaily("check", NOON)).resolves.toBeDefined();
  });

  it("caps the demo account as a whole, without using up the session's count", async () => {
    const total = DEMO_DAILY_LIMITS.check!;
    const sessions = Math.ceil(total / DAILY_LIMITS.check);
    for (let s = 0; s < sessions; s++) {
      session.user = demo(`s${s}`);
      await takeTimes(Math.min(DAILY_LIMITS.check, total - s * DAILY_LIMITS.check), "check");
    }
    session.user = demo("late");
    await expect(takeDaily("check", NOON)).rejects.toBeInstanceOf(AiDemoLimitError);
    // The late session's own count was given back when the total refused it.
    expect(await store.take("demo-session:late", "2026-10-31", "check", 1)).toBe(true);
  });

  it("has no demo-wide cap on actions the demo only fills caches with", async () => {
    expect(DEMO_DAILY_LIMITS.buyers).toBeUndefined();
    for (let s = 0; s < 20; s++) {
      session.user = demo(`s${s}`);
      await takeTimes(DAILY_LIMITS.buyers, "buyers");
    }
  });

  it("closes live AI to other accounts once only the demo's reserve is left", async () => {
    vi.stubEnv("AI_MODE", "live");
    await recordSpend(DEFAULT_DAILY_BUDGET_USD - DEMO_RESERVE_USD);
    await expect(takeDaily("read", NOON)).rejects.toBeInstanceOf(AiBudgetError);
    session.user = demo("one");
    await expect(takeDaily("read", NOON)).resolves.toBeDefined();
  });

  it("leaves the reserve alone in mock mode, where nothing is spent", async () => {
    await recordSpend(DEFAULT_DAILY_BUDGET_USD);
    await expect(takeDaily("read", NOON)).resolves.toBeDefined();
  });

  it("gives a count back once, however often asked", async () => {
    await takeTimes(DAILY_LIMITS.check - 1, "check");
    const ticket = await takeDaily("check", NOON);
    await ticket.giveBack();
    await ticket.giveBack();
    await takeDaily("check", NOON);
    await expect(takeDaily("check", NOON)).rejects.toBeInstanceOf(AiDailyLimitError);
  });
});

describe("tryTakeDaily", () => {
  it("is null instead of throwing when the count is used up", async () => {
    await takeTimes(DAILY_LIMITS.cutout, "cutout");
    expect(await tryTakeDaily("cutout", NOON)).toBeNull();
  });
});

describe("withDaily", () => {
  it("gives the count back when the model failed", async () => {
    for (let i = 0; i < DAILY_LIMITS.voice + 3; i++) {
      await expect(withDaily("voice", () => Promise.reject(new AiOutputError("transcribe", [])))).rejects.toThrow();
    }
    await expect(withDaily("voice", async () => "ok")).resolves.toBe("ok");
  });

  it("keeps the count for other errors", async () => {
    for (let i = 0; i < DAILY_LIMITS.voice; i++) {
      await expect(withDaily("voice", () => Promise.reject(new Error("bug")))).rejects.toThrow("bug");
    }
    await expect(withDaily("voice", async () => "ok")).rejects.toBeInstanceOf(AiDailyLimitError);
  });

  it("gives the count back for a result the model wasn't used for", async () => {
    for (let i = 0; i < DAILY_LIMITS.pairings + 3; i++) {
      await withDaily("pairings", async () => ({ calls: 0 }), { result: (r) => r.calls === 0 });
    }
    await expect(withDaily("pairings", async () => ({ calls: 1 }))).resolves.toEqual({ calls: 1 });
  });
});

describe("takeSignup", () => {
  it("lets each IP sign up a few times a day", async () => {
    for (let i = 0; i < SIGNUPS_PER_IP_PER_DAY; i++) expect(await takeSignup("ip-a", NOON)).not.toBeNull();
    expect(await takeSignup("ip-a", NOON)).toBeNull();
    expect(await takeSignup("ip-b", NOON)).not.toBeNull();
    expect(await takeSignup("ip-a", new Date("2026-11-01T17:00:00Z"))).not.toBeNull();
  });
});

describe("secondsUntilTomorrow", () => {
  it("counts to the next Chicago midnight", () => {
    expect(secondsUntilTomorrow(new Date("2026-10-30T04:59:00Z"))).toBe(60); // 23:59 CDT
    expect(secondsUntilTomorrow(new Date("2026-10-30T05:00:00Z"))).toBe(24 * 3600);
  });

  it("follows the clock change at the end of daylight saving time", () => {
    // 2026-11-01 has 25 hours in Chicago.
    expect(secondsUntilTomorrow(new Date("2026-11-01T05:00:00Z"))).toBe(25 * 3600);
    expect(secondsUntilTomorrow(new Date("2026-11-01T18:00:00Z"))).toBe(12 * 3600); // noon CST
  });

  it("and at its start", () => {
    // 2027-03-14 has 23 hours in Chicago.
    expect(secondsUntilTomorrow(new Date("2027-03-14T06:00:00Z"))).toBe(23 * 3600);
  });
});

describe("aiErrorResponse", () => {
  it("answers a used-up daily limit with 429 and Retry-After", async () => {
    const res = aiErrorResponse(new AiDailyLimitError("check", 3600));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3600");
    expect(await res.json()).toMatchObject({ error: "AiDailyLimitError" });
  });

  it("sends no Retry-After for the app-wide budget", () => {
    expect(aiErrorResponse(new AiBudgetError("check")).headers.get("Retry-After")).toBeNull();
  });
});
