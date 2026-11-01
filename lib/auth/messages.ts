// Copy shared by the auth pages, the write guard and the read-only notices.
// No server-only imports here: the client bundles this file.
export const DEMO_READ_ONLY = "Demo account is read-only. Sign up to add your own.";
export const DEMO_READ_ONLY_ERROR = "demo_read_only";

export type AuthError =
  | "missing_email"
  | "missing_password"
  | "bad_login"
  | "taken"
  | "weak_password"
  | "bad_email"
  | "demo_unavailable"
  | "too_many_signups"
  | "failed";

export const AUTH_ERRORS: Record<AuthError, string> = {
  missing_email: "Enter your email.",
  missing_password: "Enter a password.",
  bad_login: "Wrong email or password.",
  taken: "That email already has an account. Log in instead.",
  weak_password: "Use at least 6 characters.",
  bad_email: "That email doesn't look right.",
  demo_unavailable: "The demo account isn't set up here.",
  too_many_signups: "Too many sign-ups from here today. Try again tomorrow.",
  failed: "Something went wrong. Try again.",
};

// Which box an error belongs to: it shows under that box. Wrong email or
// password marks both boxes and shows under the password. The rest are about
// the whole form.
export const AUTH_ERROR_FIELD: Partial<Record<AuthError, "email" | "password">> = {
  missing_email: "email",
  bad_email: "email",
  taken: "email",
  missing_password: "password",
  weak_password: "password",
  bad_login: "password",
};

export const MIN_PASSWORD_LENGTH = 6;
