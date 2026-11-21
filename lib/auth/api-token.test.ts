import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_USER_ID } from "../db/demo-user";
import { bearerToken, hashToken, isLockedDemo, newToken, TOKEN_PREFIX } from "./api-token";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("newToken", () => {
  it("is fc_ plus 32 random bytes in base64url", () => {
    const { token } = newToken();
    expect(token).toMatch(/^fc_[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token.slice(TOKEN_PREFIX.length), "base64url")).toHaveLength(32);
  });

  it("is different every time", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => newToken().token));
    expect(tokens.size).toBe(50);
  });

  it("comes with its SHA-256 hash, which is all that gets stored", () => {
    const { token, hash } = newToken();
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token.slice(TOKEN_PREFIX.length));
  });
});

describe("hashToken", () => {
  it("gives the same hash for the same token, and another for another", () => {
    expect(hashToken("fc_a")).toBe(hashToken("fc_a"));
    expect(hashToken("fc_a")).not.toBe(hashToken("fc_b"));
  });
});

describe("bearerToken", () => {
  const { token } = newToken();

  it("reads the token from a Bearer header", () => {
    expect(bearerToken(`Bearer ${token}`)).toBe(token);
    expect(bearerToken(`bearer  ${token} `)).toBe(token);
  });

  it("is null without a header or with another scheme", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken(token)).toBeNull();
    expect(bearerToken(`Basic ${token}`)).toBeNull();
  });

  it("is null for anything not shaped like our tokens", () => {
    expect(bearerToken("Bearer hello")).toBeNull();
    expect(bearerToken(`Bearer ${token.slice(0, -1)}`)).toBeNull();
    expect(bearerToken(`Bearer ${token}x`)).toBeNull();
    expect(bearerToken(`Bearer xx_${token.slice(3)}`)).toBeNull();
    expect(bearerToken(`Bearer ${token} extra`)).toBeNull();
  });
});

describe("isLockedDemo", () => {
  it("is the demo persona with sign-in on", () => {
    vi.stubEnv("AUTH_REQUIRED", "1");
    vi.stubEnv("DEMO_WRITABLE", "");
    expect(isLockedDemo(DEMO_USER_ID)).toBe(true);
    expect(isLockedDemo("someone-else")).toBe(false);
  });

  it("is no one with sign-in off, or while the demo is writable", () => {
    vi.stubEnv("AUTH_REQUIRED", "");
    expect(isLockedDemo(DEMO_USER_ID)).toBe(false);
    vi.stubEnv("AUTH_REQUIRED", "1");
    vi.stubEnv("DEMO_WRITABLE", "1");
    expect(isLockedDemo(DEMO_USER_ID)).toBe(false);
  });
});
