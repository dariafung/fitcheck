import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUT } from "@/app/api/profile/wear-log/route";
import { wearLogEnabled } from "@/lib/wear/settings";
import { request, wearCloset } from "./helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: async () => user.id }));

let closet: Awaited<ReturnType<typeof wearCloset>>;

beforeEach(async () => {
  closet = await wearCloset();
  user.id = closet.userId;
});
afterEach(async () => {
  await closet.cleanup();
});

describe("PUT /api/profile/wear-log", () => {
  it("starts on, turns off and back on, and keeps the log", async () => {
    expect(await wearLogEnabled(closet.db, closet.userId)).toBe(true);
    await closet.db.from("outfit_logs").insert({ user_id: closet.userId, worn_on: "2026-10-01", item_ids: [closet.tee] }).throwOnError();

    const off = await PUT(request("PUT", "/api/profile/wear-log", { enabled: false }));
    expect(await off.json()).toEqual({ enabled: false });
    expect(await wearLogEnabled(closet.db, closet.userId)).toBe(false);

    await PUT(request("PUT", "/api/profile/wear-log", { enabled: true }));
    expect(await wearLogEnabled(closet.db, closet.userId)).toBe(true);
    const { count } = await closet.db.from("outfit_logs").select("id", { count: "exact", head: true }).eq("user_id", closet.userId);
    expect(count).toBe(1);
  });

  it("wants a true or false", async () => {
    expect((await PUT(request("PUT", "/api/profile/wear-log", { enabled: "no" }))).status).toBe(400);
  });
});
