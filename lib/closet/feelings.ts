import type { FeelingStructured } from "@/lib/ai/schemas/common";
import type { Db } from "@/lib/db/server";
import type { FeelingSource } from "./feeling-body";
import { mergeFeeling } from "./feeling-merge";

export async function latestFeeling(db: Db, itemId: string) {
  const { data } = await db
    .from("item_feelings")
    .select("id, raw_text")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .throwOnError();
  return data;
}

// One feeling per item. Editing replaces the text; the old structured fields
// stay until the background parse merges the new ones in, and parsed_at is
// cleared meanwhile to show they lag behind the text. The source follows the
// latest save.
export async function saveFeeling(
  db: Db,
  {
    itemId,
    userId,
    text,
    source = "typed",
  }: { itemId: string; userId: string; text: string; source?: FeelingSource },
): Promise<{ id: string }> {
  const existing = await latestFeeling(db, itemId);
  if (existing) {
    await db
      .from("item_feelings")
      .update({ raw_text: text, source, parsed_at: null })
      .eq("id", existing.id)
      .throwOnError();
    return { id: existing.id };
  }
  const { data } = await db
    .from("item_feelings")
    .insert({ item_id: itemId, user_id: userId, raw_text: text, source })
    .select("id")
    .single()
    .throwOnError();
  return data;
}

// Merges into the stored fields. Only lands if the text is still the one that
// was parsed, so a slow parse cannot overwrite the result for a newer edit.
export async function storeParsedFeeling(
  db: Db,
  { feelingId, text, structured }: { feelingId: string; text: string; structured: FeelingStructured },
): Promise<void> {
  const { data: current } = await db
    .from("item_feelings")
    .select("structured")
    .eq("id", feelingId)
    .eq("raw_text", text)
    .maybeSingle()
    .throwOnError();
  if (!current) return;
  await db
    .from("item_feelings")
    .update({
      structured: mergeFeeling(current.structured, structured),
      parsed_at: new Date().toISOString(),
    })
    .eq("id", feelingId)
    .eq("raw_text", text)
    .throwOnError();
}
