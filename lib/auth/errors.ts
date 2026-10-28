import type { AuthError } from "./messages";

// Supabase Auth error codes → what the page says. Anything else is generic.
const BY_CODE: Record<string, AuthError> = {
  invalid_credentials: "bad_login",
  user_already_exists: "taken",
  email_exists: "taken",
  weak_password: "weak_password",
  email_address_invalid: "bad_email",
  validation_failed: "bad_email",
};

export function authErrorFor(error: { code?: string } | null | undefined): AuthError {
  return (error?.code && BY_CODE[error.code]) || "failed";
}
