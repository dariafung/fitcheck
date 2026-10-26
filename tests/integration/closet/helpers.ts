import { randomUUID } from "node:crypto";
import { createServerClient } from "@/lib/db/server";

// A throwaway user with one item. The local database is shared by every lane,
// so rows use random ids and `cleanup` removes them (items and feelings cascade).
export async function createTestCloset() {
  const db = createServerClient();
  const userId = randomUUID();
  await db.from("users").insert({ id: userId, display_name: "Closet test user" }).throwOnError();
  const { data: item } = await db
    .from("items")
    .insert({
      user_id: userId,
      entry_method: "manual",
      title: "Test linen shirt",
      category: "top",
      ai_tags: {
        category: "top",
        colors: [{ name: "sand" }],
        materials: ["linen"],
        fit: "relaxed",
        formality: 2,
        seasons: ["summer"],
        occasions: ["social"],
        tempRangeF: { min: 65, max: 95 },
      },
      user_tags: { fit: "oversized" },
    })
    .select("id")
    .single()
    .throwOnError();

  return {
    db,
    userId,
    itemId: item.id,
    cleanup: () => db.from("users").delete().eq("id", userId).throwOnError(),
  };
}
