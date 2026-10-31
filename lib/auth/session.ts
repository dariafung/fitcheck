import { cache } from "react";
import { DEMO_USER_ID } from "../db/demo-user";
import { createAuthClient } from "./client";
import { authRequired } from "./config";

export interface SessionUser {
  id: string;
  email: string | null;
  // The shared demo persona: can look, can't change anything.
  readOnly: boolean;
  // This login's session, for the demo account's per-login AI limits.
  sessionId: string | null;
}

// The signed-in user from the session cookie, or null. getClaims checks the
// token's signature, unlike getSession. Read once per request.
export const sessionUser = cache(async (): Promise<SessionUser | null> => {
  const auth = await createAuthClient();
  const { data } = await auth.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    readOnly: claims.sub === DEMO_USER_ID,
    sessionId: typeof claims.session_id === "string" ? claims.session_id : null,
  };
});

// With sign-in off everyone is the persona, and the persona can write.
export async function isReadOnly(): Promise<boolean> {
  if (!authRequired()) return false;
  return (await sessionUser())?.readOnly ?? false;
}
