// The name other people see (users.display_name): picked at sign-up, changed
// in Profile, never taken from the email. Names may repeat. No server-only
// imports: the sign-up and profile forms use this too.
import { z } from "zod";

export const MIN_NICKNAME_LENGTH = 2;
export const MAX_NICKNAME_LENGTH = 30;
// For the rare account without a name of its own (one made before names, or
// whose users row was made without the sign-up form).
export const DEFAULT_NICKNAME = "fitcheck member";

export const Nickname = z.string().trim().min(MIN_NICKNAME_LENGTH).max(MAX_NICKNAME_LENGTH);

// The name if it is a usable one, else DEFAULT_NICKNAME.
export function nicknameOrDefault(name: unknown): string {
  const parsed = Nickname.safeParse(name);
  return parsed.success ? parsed.data : DEFAULT_NICKNAME;
}
