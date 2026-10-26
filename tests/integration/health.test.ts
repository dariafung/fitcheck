import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { parseFeeling } from "@/lib/ai";
import { createServerClient } from "@/lib/db/server";

// Rows created here use random ids and are removed afterwards; the local
// database is shared by every lane.
const userId = randomUUID();

afterEach(async () => {
  await createServerClient().from("users").delete().eq("id", userId);
});

describe("GET /api/health", () => {
  it("reports a reachable database and mock AI", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ db: "ok", ai: "mock" });
  });
});

describe("database + AI mock round trip", () => {
  it("stores a parsed feeling for a new item", async () => {
    const db = createServerClient();
    await db.from("users").insert({ id: userId, display_name: "Test user" }).throwOnError();
    const { data: item } = await db
      .from("items")
      .insert({
        user_id: userId,
        entry_method: "manual",
        title: "Test tee",
        category: "top",
      })
      .select()
      .single()
      .throwOnError();

    const text = "Love it, very flattering.";
    const structured = await parseFeeling({
      text,
      item: {
        id: item.id,
        title: item.title,
        tags: {
          category: "top",
          colors: [],
          materials: [],
          formality: 2,
          seasons: [],
          occasions: ["social"],
        },
      },
    });
    expect(structured.flattering).toBe("yes");

    const { data: feeling } = await db
      .from("item_feelings")
      .insert({ item_id: item.id, user_id: userId, raw_text: text, source: "typed", structured })
      .select()
      .single()
      .throwOnError();
    expect(feeling.structured).toMatchObject({ flattering: "yes" });
  });
});
