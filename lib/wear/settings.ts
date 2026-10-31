import { cache } from "react";
import { createServerClient, type Db } from "@/lib/db/server";

// Whether the user keeps an outfit calendar (Profile). Off hides it
// everywhere and keeps the log. False when there's no users row yet.
export async function wearLogEnabled(db: Db, userId: string): Promise<boolean> {
  const { data } = await db.from("users").select("wear_log_enabled").eq("id", userId).maybeSingle().throwOnError();
  return data?.wear_log_enabled ?? false;
}

// Read once per request: the nav, the page and the item page all ask.
export const wearLogEnabledFor = cache((userId: string) => wearLogEnabled(createServerClient(), userId));

export async function setWearLogEnabled(db: Db, userId: string, enabled: boolean): Promise<void> {
  await db.from("users").update({ wear_log_enabled: enabled }).eq("id", userId).throwOnError();
}
