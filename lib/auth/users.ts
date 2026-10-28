import type { Db } from "../db/server";

// What we call a new account: the part of the email before the @.
export function displayNameFor(email: string | null | undefined): string {
  const name = email?.split("@")[0]?.trim();
  return name || "me";
}

// The users row every closet, feeling and profile hangs off. Made right after
// sign-up; an existing row (the persona included) is left exactly as it is.
export async function ensureUserRow(db: Db, id: string, email: string | null | undefined) {
  await db
    .from("users")
    .upsert({ id, display_name: displayNameFor(email) }, { onConflict: "id", ignoreDuplicates: true })
    .throwOnError();
}

// Users this server process already made sure of, so the backstop in
// currentUserId writes at most once per user per process.
const known = new Set<string>();

export async function ensureKnownUser(db: Db, id: string, email: string | null | undefined) {
  if (known.has(id)) return;
  await ensureUserRow(db, id, email);
  known.add(id);
}
