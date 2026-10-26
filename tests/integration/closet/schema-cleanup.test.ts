import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createServerClient } from "@/lib/db/server";

// Random ids, removed afterwards: the local database is shared by every lane.
const userId = randomUUID();

afterEach(async () => {
  await createServerClient().from("users").delete().eq("id", userId);
});

describe("items.status", () => {
  it("is only active or passing_on", async () => {
    const db = createServerClient();
    await db.from("users").insert({ id: userId, display_name: "Status test user" }).throwOnError();
    const { data: item } = await db
      .from("items")
      .insert({ user_id: userId, entry_method: "manual", title: "Status test tee", category: "top" })
      .select("id")
      .single()
      .throwOnError();

    for (const status of ["idle", "candidate"]) {
      const res = await db.from("items").update({ status }).eq("id", item.id);
      expect(res.error?.message).toContain("items_status_check");
    }
    for (const status of ["passing_on", "active"]) {
      const ok = await db.from("items").update({ status }).eq("id", item.id);
      expect(ok.error).toBeNull();
    }
  });
});

describe("purchase_checks", () => {
  it("is gone: a purchase check keeps nothing", async () => {
    const { error } = await createServerClient().from("purchase_checks" as "items").select("id").limit(1);
    expect(error?.code).toBe("PGRST205");
  });
});
