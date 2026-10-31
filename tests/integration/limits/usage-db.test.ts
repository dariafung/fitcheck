import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createServerClient } from "@/lib/db/server";
import { dbUsageStore } from "@/lib/limits/usage-db";

// A random far-future day and subject, so real counts and other lanes are
// never touched.
const day = new Date(Date.UTC(2900, 0, 1 + Math.floor(Math.random() * 365 * 50)))
  .toISOString()
  .slice(0, 10);
const subject = `test:${randomUUID()}`;

afterEach(async () => {
  await createServerClient().from("ai_usage_days").delete().eq("day", day).throwOnError();
});

async function count(action: string): Promise<number> {
  const { data } = await createServerClient()
    .from("ai_usage_days")
    .select("count")
    .eq("subject", subject)
    .eq("day", day)
    .eq("action", action)
    .maybeSingle()
    .throwOnError();
  return data?.count ?? 0;
}

describe("dbUsageStore", () => {
  it("never lets concurrent takes pass the limit", async () => {
    const store = dbUsageStore();
    const results = await Promise.all(Array.from({ length: 20 }, () => store.take(subject, day, "check", 13)));
    expect(results.filter(Boolean)).toHaveLength(13);
    expect(await count("check")).toBe(13);
  });

  it("refuses everything with a limit of 0", async () => {
    expect(await dbUsageStore().take(subject, day, "check", 0)).toBe(false);
    expect(await count("check")).toBe(0);
  });

  it("gives back one at a time, never below 0", async () => {
    const store = dbUsageStore();
    await store.take(subject, day, "read", 5);
    await store.take(subject, day, "read", 5);
    await store.giveBack(subject, day, "read");
    expect(await count("read")).toBe(1);
    await store.giveBack(subject, day, "read");
    await store.giveBack(subject, day, "read");
    await store.giveBack(subject, day, "style");
    expect(await count("read")).toBe(0);
    expect(await count("style")).toBe(0);
  });

  it("counts each action on its own", async () => {
    const store = dbUsageStore();
    expect(await store.take(subject, day, "check", 1)).toBe(true);
    expect(await store.take(subject, day, "check", 1)).toBe(false);
    expect(await store.take(subject, day, "read", 1)).toBe(true);
  });
});
