"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "../db/server";
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

export async function logIn(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const { email, password } = credentials(form);
  if (!email || !password) return { error: "missing", email };
  const auth = await createAuthClient();
  const { error } = await auth.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorFor(error), email };
  redirect("/");
}

// No email confirmation: the account works as soon as it exists. If the
// users row fails here, currentUserId makes it on the next request.
export async function signUp(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const { email, password } = credentials(form);
  if (!email || !password) return { error: "missing", email };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: "weak_password", email };
  const auth = await createAuthClient();
  const { data, error } = await auth.auth.signUp({ email, password });
  if (error || !data.session) return { error: authErrorFor(error), email };
  await ensureUserRow(createServerClient(), data.session.user.id, email).catch((err: unknown) => {
    console.error("users row after sign-up", err);
  });
  redirect("/closet");
}

export async function tryDemo(): Promise<AuthFormState> {
  const password = demoPassword();
  if (!password) return { error: "demo_unavailable" };
  const auth = await createAuthClient();
  const { error } = await auth.auth.signInWithPassword({ email: DEMO_EMAIL, password });
  if (error) return { error: error.code === "invalid_credentials" ? "demo_unavailable" : "failed" };
  redirect("/");
}

export async function logOut(): Promise<void> {
  const auth = await createAuthClient();
  await auth.auth.signOut({ scope: "local" });
  redirect("/login");
}
