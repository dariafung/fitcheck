import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "@/app/api/profile/tokens/route";
import { hashToken, SHORTCUT_TOKEN_LABEL, tokenInfo, userForToken } from "@/lib/auth/api-token";
import { DEMO_READ_ONLY, DEMO_READ_ONLY_ERROR } from "@/lib/auth/messages";
import { DEMO_USER_ID } from "@/lib/db/demo-user";
import { createServerClient } from "@/lib/db/server";

// Sign-in on: the real session, current-user and guard code, with only the
// Supabase Auth call faked.
const claims = vi.hoisted(() => ({ sub: "" }));
vi.mock("@/lib/auth/client", () => ({
  createAuthClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { ...claims, email: `${claims.sub}@example.com` } } }) },
  }),
}));

const db = createServerClient();
const userId = randomUUID();
const otherId = randomUUID();

async function rows(id: string) {
  const { data } = await db.from("api_tokens").select("*").eq("user_id", id).throwOnError();
  return data;
}

beforeAll(async () => {
  vi.stubEnv("AUTH_REQUIRED", "1");
  await db
    .from("users")
    .insert([
      { id: userId, display_name: "Token test" },
      { id: otherId, display_name: "Token test, other" },
    ])
    .throwOnError();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await db.from("users").delete().in("id", [userId, otherId]).throwOnError();
});

beforeEach(() => {
  claims.sub = userId;
});

describe("POST /api/profile/tokens", () => {
  it("makes a token, shows it once and keeps only its hash", async () => {
    expect(await tokenInfo(db, userId)).toBeNull();
    const res = await POST();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toMatch(/^fc_[A-Za-z0-9_-]{43}$/);
    expect(body.lastUsedAt).toBeNull();

    const stored = await rows(userId);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ token_hash: hashToken(body.token), label: SHORTCUT_TOKEN_LABEL, last_used_at: null });
    expect(stored[0].created_at).toBe(body.createdAt);
    expect(JSON.stringify(stored)).not.toContain(body.token);
    expect(await tokenInfo(db, userId)).toEqual({ createdAt: body.createdAt, lastUsedAt: null });
    expect(await userForToken(db, body.token)).toBe(userId);
  });

  it("replaces the token the account had", async () => {
    const first = (await (await POST()).json()).token;
    const second = (await (await POST()).json()).token;
    expect(second).not.toBe(first);
    expect(await rows(userId)).toHaveLength(1);
    expect(await userForToken(db, first)).toBeNull();
    expect(await userForToken(db, second)).toBe(userId);
  });

  it("leaves other accounts' tokens alone", async () => {
    claims.sub = otherId;
    const theirs = (await (await POST()).json()).token;
    claims.sub = userId;
    await POST();
    await DELETE();
    expect(await userForToken(db, theirs)).toBe(otherId);
  });
});

describe("DELETE /api/profile/tokens", () => {
  it("revokes the token at once", async () => {
    const token = (await (await POST()).json()).token;
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revoked: true });
    expect(await rows(userId)).toEqual([]);
    expect(await userForToken(db, token)).toBeNull();
    expect(await tokenInfo(db, userId)).toBeNull();
  });

  it("is fine with nothing to revoke", async () => {
    expect((await DELETE()).status).toBe(200);
  });
});

describe("the demo account", () => {
  beforeEach(() => {
    claims.sub = DEMO_USER_ID;
  });

  it("can't make or revoke a token", async () => {
    const before = await rows(DEMO_USER_ID);
    for (const res of [await POST(), await DELETE()]) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: DEMO_READ_ONLY_ERROR, message: DEMO_READ_ONLY });
    }
    expect(await rows(DEMO_USER_ID)).toEqual(before);
  });
});
