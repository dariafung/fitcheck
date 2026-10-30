import { randomUUID } from "node:crypto";
import { createServerClient } from "@/lib/db/server";

const PIECES = [
  { title: "Test tee", category: "top" },
  { title: "Test jeans", category: "bottom" },
  { title: "Test sneakers", category: "shoes" },
] as const;

// A throwaway user with a tee, jeans and sneakers. The local database is
// shared, so everything is under a random user that `cleanup` deletes
// (items, outfits and insights cascade).
export async function wearCloset() {
  const db = createServerClient();
  const userId = randomUUID();
  await db
    .from("users")
    .insert({ id: userId, display_name: "Calendar test user", lifestyle_mix: { work: 0, school: 3, social: 0, sport: 2, home: 0 } })
    .throwOnError();
  const { data } = await db
    .from("items")
    .insert(
      PIECES.map((p) => ({
        user_id: userId,
        entry_method: "manual",
        title: p.title,
        category: p.category,
        // Owned well before any log, so nothing counts as new.
        created_at: "2026-01-01T12:00:00Z",
        ai_tags: { category: p.category, colors: [{ name: "white" }], materials: ["cotton"], formality: 2, occasions: [] },
      })),
    )
    .select("id, category")
    .throwOnError();
  const id = (category: string) => data.find((i) => i.category === category)!.id;
  return {
    db,
    userId,
    tee: id("top"),
    jeans: id("bottom"),
    sneakers: id("shoes"),
    cleanup: () => db.from("users").delete().eq("id", userId).throwOnError(),
  };
}

export function request(method: string, url: string, body?: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
