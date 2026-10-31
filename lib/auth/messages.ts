// Copy shared by the auth pages, the write guard and the read-only notices.
// No server-only imports here: the client bundles this file.
export const DEMO_READ_ONLY = "Demo account is read-only. Sign up to add your own.";
export const DEMO_READ_ONLY_ERROR = "demo_read_only";

export type AuthError =
  | "missing"
  | "bad_login"
  | "taken"
  | "weak_password"
  | "bad_email"
  | "demo_unavailable"
  | "too_many_signups"
  | "failed";

export const AUTH_ERRORS: Record<AuthError, string> = {
  missing: "Enter your email and a password.",
  bad_login: "Wrong email or password.",
  taken: "That email already has an account. Log in instead.",
  weak_password: "Use at least 6 characters.",
  bad_email: "That email doesn't look right.",
  demo_unavailable: "The demo account isn't set up here.",
  too_many_signups: "Too many sign-ups from here today. Try again tomorrow.",
  failed: "Something went wrong. Try again.",
};

export const MIN_PASSWORD_LENGTH = 6;
