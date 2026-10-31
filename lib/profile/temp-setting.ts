import { connection } from "next/server";
import { cache } from "react";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient, type Db } from "@/lib/db/server";
import { DEFAULT_TEMP_UNIT, parseTempUnit, type TempUnit } from "./temp-unit";

// The profile's temperature unit; °F until the user picks one.
export async function tempUnit(db: Db, userId: string): Promise<TempUnit> {
  const { data } = await db.from("users").select("temp_unit").eq("id", userId).maybeSingle().throwOnError();
  return parseTempUnit(data?.temp_unit);
}

// Read once per request.
export const tempUnitFor = cache((userId: string) => tempUnit(createServerClient(), userId));

// For a page that hands the unit to a client card without waiting on it
// (the card reads it with use()). Waits for the request first, so a
// prerendered shell never reads the session. °F on any failure.
export function currentTempUnit(): Promise<TempUnit> {
  return connection()
    .then(currentUserId)
    .then(tempUnitFor)
    .catch(() => DEFAULT_TEMP_UNIT);
}
