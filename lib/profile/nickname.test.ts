import { describe, expect, it } from "vitest";
import { DEFAULT_NICKNAME, Nickname, nicknameOrDefault } from "./nickname";

describe("Nickname", () => {
  it("takes 2 to 30 characters, trimmed", () => {
    expect(Nickname.parse("  jo ")).toBe("jo");
    expect(Nickname.safeParse("j").success).toBe(false);
    expect(Nickname.safeParse("x".repeat(31)).success).toBe(false);
    expect(Nickname.parse("x".repeat(30))).toHaveLength(30);
  });
});

describe("nicknameOrDefault", () => {
  it("keeps a usable name and falls back otherwise, never using an email", () => {
    expect(nicknameOrDefault("figment")).toBe("figment");
    expect(nicknameOrDefault(" ")).toBe(DEFAULT_NICKNAME);
    expect(nicknameOrDefault(null)).toBe(DEFAULT_NICKNAME);
    expect(nicknameOrDefault(undefined)).toBe(DEFAULT_NICKNAME);
    expect(DEFAULT_NICKNAME).toBe("fitcheck member");
  });
});
