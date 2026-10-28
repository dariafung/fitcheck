import { afterEach, describe, expect, it } from "vitest";
import { dbBudgetStore } from "@/lib/ai/budget-db";
import { createServerClient } from "@/lib/db/server";

// A random far-future day, so real spend and other lanes are never touched.
const day = new Date(Date.UTC(2900, 0, 1 + Math.floor(Math.random() * 365 * 50)))
  .toISOString()
  .slice(0, 10);

afterEach(async () => {
  await createServerClient().from("ai_budget_days").delete().eq("day", day).throwOnError();
});

describe("dbBudgetStore", () => {
  it("never lets concurrent reservations pass the limit", async () => {
    const store = dbBudgetStore();
    const results = await Promise.all(Array.from({ length: 20 }, () => store.reserve(day, 0.3, 4)));
    expect(results.filter(Boolean)).toHaveLength(13);
    expect(await store.spent(day)).toBeCloseTo(3.9, 9);
  });

  it("refuses a first reservation larger than the limit", async () => {
    const store = dbBudgetStore();
    expect(await store.reserve(day, 5, 4)).toBe(false);
    expect(await store.spent(day)).toBe(0);
  });

  it("keeps only the real cost after settling", async () => {
    const store = dbBudgetStore();
    expect(await store.reserve(day, 0.05, 4)).toBe(true);
    await store.settle(day, 0.0123);
    await store.settle(day, -0.05);
    expect(await store.spent(day)).toBeCloseTo(0.0123, 9);
  });
});
