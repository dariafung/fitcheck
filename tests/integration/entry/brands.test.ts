import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/items/brands/route";
import { createServerClient } from "@/lib/db/server";
import { createTestUser, removeTestUser } from "./helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));
let other = "";

function item(userId: string, brand: string | null, status: "active" | "passing_on" = "active") {
  return { user_id: userId, entry_method: "manual", title: "Brand test item", category: "top", brand, status };
}

beforeAll(async () => {
  user.id = await createTestUser();
  other = await createTestUser();
  await createServerClient()
    .from("items")
    .insert([
      item(user.id, "Tiny Studio"),
      item(user.id, "zara"),
      item(user.id, "ZARA", "passing_on"),
      item(user.id, "Zara"),
      item(user.id, null),
      item(other, "Someone Else's Brand"),
    ])
    .throwOnError();
});
afterAll(async () => {
  await removeTestUser(user.id);
  await removeTestUser(other);
});

describe("GET /api/items/brands", () => {
  it("lists the user's own brands once each, the most saved first", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    // Three ZARA spellings (passing-on included) count as one brand, written as the built-in list does.
    expect(await res.json()).toEqual({ brands: ["ZARA", "Tiny Studio"] });
  });
});
