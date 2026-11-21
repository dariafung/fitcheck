import { connection } from "next/server";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";

// How many active items the current user has, for a page that hands it to a
// client component without waiting on it (read there with use()). Waits for
// the request first, so a prerendered shell never reads the session. Null
// on any failure: the page then says nothing about progress.
export function currentActiveItemCount(): Promise<number | null> {
  return connection()
    .then(currentUserId)
    .then(async (userId) => {
      const { count } = await createServerClient()
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active")
        .throwOnError();
      return count;
    })
    .catch(() => null);
}
