"use server";

import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createServerClient } from "../db/server";
import { takeSignup } from "../limits/daily";
import { signupIpHash } from "../limits/ip";
import { createAuthClient } from "./client";
import { DEMO_EMAIL, demoPassword } from "./config";
import { authErrorFor } from "./errors";
import { MIN_PASSWORD_LENGTH, type AuthError } from "./messages";
import { ensureUserRow } from "./users";

export interface AuthFormState {
  error?: AuthError;
  email?: string;
}

function credentials(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  return { email, password };
}

// The first empty box, if any.
function missing(email: string, password: string): AuthError | null {
  if (!email) return "missing_email";
  if (!password) return "missing_password";
  return null;
}

// A request that never reached Supabase Auth (a dropped connection) gets
// one more try before the page says something went wrong.
async function signIn(email: string, password: string) {
  const auth = await createAuthClient();
  const first = await auth.auth.signInWithPassword({ email, password });
  if (!isAuthRetryableFetchError(first.error)) return first;
  return auth.auth.signInWithPassword({ email, password });
}

export async function logIn(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const { email, password } = credentials(form);
  const empty = missing(email, password);
  if (empty) return { error: empty, email };
  const { error } = await signIn(email, password);
  if (error) return { error: authErrorFor(error), email };
  redirect("/");
}

// No email confirmation: the account works as soon as it exists. If the
// users row fails here, currentUserId makes it on the next request. Each IP
// gets SIGNUPS_PER_IP_PER_DAY a day (on Vercel, where the IP can be
// trusted); a sign-up that fails gives its count back.
export async function signUp(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const { email, password } = credentials(form);
  const empty = missing(email, password);
  if (empty) return { error: empty, email };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: "weak_password", email };
  const ipHash = await signupIpHash();
  const ticket = ipHash ? await takeSignup(ipHash) : null;
  if (ipHash && !ticket) return { error: "too_many_signups", email };
  const auth = await createAuthClient();
  const { data, error } = await auth.auth.signUp({ email, password });
  if (error || !data.session) {
    await ticket?.giveBack();
    return { error: authErrorFor(error), email };
  }
  await ensureUserRow(createServerClient(), data.session.user.id, email).catch((err: unknown) => {
    console.error("users row after sign-up", err);
  });
  redirect("/closet");
}

export async function tryDemo(): Promise<AuthFormState> {
  const password = demoPassword();
  if (!password) return { error: "demo_unavailable" };
  const { error } = await signIn(DEMO_EMAIL, password);
  if (error) return { error: error.code === "invalid_credentials" ? "demo_unavailable" : "failed" };
  redirect("/");
}

export async function logOut(): Promise<void> {
  const auth = await createAuthClient();
  await auth.auth.signOut({ scope: "local" });
  redirect("/login");
}
