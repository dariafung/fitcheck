import { redirect } from "next/navigation";
import { authRequired } from "../auth/config";
import { sessionUser } from "../auth/session";
import { ensureKnownUser } from "../auth/users";
import { DEMO_USER_ID } from "./demo-user";
import { createServerClient } from "./server";

export { DEMO_USER_ID };

// Every lane reads the current user from here only. With sign-in off (local
// dev, the default e2e run) it is always the demo persona; on, it is the
// signed-in user. proxy.ts already sends signed-out pages to /login; this
// covers anything that slips past it, API routes included. Also makes the
// users row if sign-up didn't get to it.
export async function currentUserId(): Promise<string> {
  if (!authRequired()) return DEMO_USER_ID;
  const user = await sessionUser();
  if (!user) redirect("/login");
  if (!user.readOnly) await ensureKnownUser(createServerClient(), user.id, user.email);
  return user.id;
}
