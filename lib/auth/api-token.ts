// Personal tokens for calls made outside the browser (the iOS Shortcut,
// docs/SHORTCUT.md). A token is shown once, when it is made in Profile; the
// api_tokens table keeps only its SHA-256 hash. Sent as
// `Authorization: Bearer <token>`.
import { createHash, randomBytes } from "node:crypto";
import { DEMO_USER_ID } from "../db/demo-user";
import type { Db } from "../db/server";
import { authRequired, demoLocked } from "./config";

export const TOKEN_PREFIX = "fc_";
const TOKEN_BYTES = 32;
// 32 random bytes in base64url are 43 characters.
const TOKEN_SHAPE = /^fc_[A-Za-z0-9_-]{43}$/;
// What a token made in Profile is for; the only kind there is.
export const SHORTCUT_TOKEN_LABEL = "Shortcut";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): { token: string; hash: string } {
  const token = TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, hash: hashToken(token) };
}

// The token in an Authorization header, or null when there is none or it
// isn't shaped like ours (so junk never reaches the database).
export function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return match && TOKEN_SHAPE.test(match[1]) ? match[1] : null;
}

// The shared demo persona behind a token: read-only, as in the browser
// (lib/auth/session.ts). With sign-in off everyone is the persona and it can
// write.
export function isLockedDemo(userId: string): boolean {
  return authRequired() && userId === DEMO_USER_ID && demoLocked();
}

export interface TokenInfo {
  createdAt: string;
  lastUsedAt: string | null;
}

// The user's token, without the token: null when they have none.
export async function tokenInfo(db: Db, userId: string): Promise<TokenInfo | null> {
  const { data } = await db
    .from("api_tokens")
    .select("created_at, last_used_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .throwOnError();
  return data && { createdAt: data.created_at, lastUsedAt: data.last_used_at };
}

export async function revokeTokens(db: Db, userId: string): Promise<void> {
  await db.from("api_tokens").delete().eq("user_id", userId).throwOnError();
}

// Makes the user's token, replacing the one they had: Profile shows one
// token, and the old one stops working. The token is returned here only.
export async function createToken(db: Db, userId: string): Promise<{ token: string } & TokenInfo> {
  const { token, hash } = newToken();
  await revokeTokens(db, userId);
  const { data } = await db
    .from("api_tokens")
    .insert({ user_id: userId, token_hash: hash, label: SHORTCUT_TOKEN_LABEL })
    .select("created_at")
    .single()
    .throwOnError();
  return { token, createdAt: data.created_at, lastUsedAt: null };
}

// Whose token this is, or null for one we never made or that was revoked.
// Marks it used in the same statement.
export async function userForToken(db: Db, token: string, now = new Date()): Promise<string | null> {
  const { data } = await db
    .from("api_tokens")
    .update({ last_used_at: now.toISOString() })
    .eq("token_hash", hashToken(token))
    .select("user_id")
    .maybeSingle()
    .throwOnError();
  return data?.user_id ?? null;
}
