import { connection } from "next/server";
import type { ReactNode } from "react";
import { authRequired } from "@/lib/auth/config";
import { sessionUser } from "@/lib/auth/session";

// Top-bar links that only lead somewhere once you're signed in. With sign-in
// off everyone is the persona, so they always show.
export async function SignedInOnly({ children }: { children: ReactNode }) {
  await connection();
  if (authRequired() && !(await sessionUser())) return null;
  return children;
}
