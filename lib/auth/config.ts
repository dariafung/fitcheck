import { z } from "zod";

// Sign-in is off unless AUTH_REQUIRED=1 (the hosted site). Off, everyone is
// the demo persona and can write, which is what local dev and the default
// e2e run expect.
export function authRequired(): boolean {
  return process.env.AUTH_REQUIRED === "1";
}

// The read-only demo account: the persona's auth user. Its password lives in
// DEMO_ACCOUNT_PASSWORD on the server only.
export const DEMO_EMAIL = "demo@example.com";

// DEMO_WRITABLE=1 lifts the demo account's read-only lock for a while (say,
// to record the demo video in it). Re-seed afterwards: the seed puts the
// persona back exactly as it was.
export function demoLocked(): boolean {
  return process.env.DEMO_WRITABLE !== "1";
}

const AuthEnv = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

// The auth client uses the publishable key: it only signs people in and
// reads their session. Data still goes through createServerClient().
export function authEnv() {
  return AuthEnv.parse(process.env);
}

export function demoPassword(): string | undefined {
  return process.env.DEMO_ACCOUNT_PASSWORD || undefined;
}
