import type { Db } from "@/lib/db/server";

const BUCKETS = ["item-images", "feeling-audio"] as const;

// Everything the demo persona owns that must never change, read straight
// from the database and storage. Pairings are a cache the demo account may
// add to, so they are kept apart: see pairingKeys.
export async function personaSnapshot(db: Db, personaId: string) {
  const [users, items, feelings, styleProfiles, outfitLogs] = await Promise.all([
    db.from("users").select("*").eq("id", personaId).throwOnError(),
    db.from("items").select("*").eq("user_id", personaId).order("id").throwOnError(),
    db.from("item_feelings").select("*").eq("user_id", personaId).order("id").throwOnError(),
    db.from("style_profiles").select("*").eq("user_id", personaId).order("id").throwOnError(),
    db.from("outfit_logs").select("*").eq("user_id", personaId).order("id").throwOnError(),
  ]);
  const files: Record<string, string[]> = {};
  for (const bucket of BUCKETS) {
    const { data, error } = await db.storage.from(bucket).list(personaId, { limit: 1000 });
    if (error) throw error;
    files[bucket] = data.map((f) => `${f.name}:${f.updated_at}`).sort();
  }
  return {
    users: users.data,
    items: items.data,
    feelings: feelings.data,
    styleProfiles: styleProfiles.data,
    outfitLogs: outfitLogs.data,
    files,
  };
}

export async function pairingKeys(db: Db, personaId: string): Promise<string[]> {
  const { data } = await db
    .from("pairings")
    .select("item_a_id, item_b_id")
    .eq("user_id", personaId)
    .throwOnError();
  return data.map((p) => `${p.item_a_id}|${p.item_b_id}`).sort();
}
