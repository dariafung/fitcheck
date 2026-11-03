import type { Db } from "../db/server";
import { nicknameOrDefault } from "../profile/nickname";

// The users row every closet, feeling and profile hangs off. Made right after
// sign-up with the name from the form (DEFAULT_NICKNAME without one, never
// anything from the email); an existing row (the persona included) is left
// exactly as it is.
export async function ensureUserRow(db: Db, id: string, name: string | null | undefined) {
  await db
    .from("users")
    .upsert({ id, display_name: nicknameOrDefault(name) }, { onConflict: "id", ignoreDuplicates: true })
    .throwOnError();
}

// Users this server process already made sure of, so the backstop in
// currentUserId writes at most once per user per process.
const known = new Set<string>();

export async function ensureKnownUser(db: Db, id: string, name: string | null | undefined) {
  if (known.has(id)) return;
  await ensureUserRow(db, id, name);
  known.add(id);
}
