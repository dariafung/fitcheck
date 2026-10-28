import { describe, expect, it } from "vitest";
import { authErrorFor } from "./errors";

describe("authErrorFor", () => {
  it("maps known Supabase codes", () => {
    expect(authErrorFor({ code: "invalid_credentials" })).toBe("bad_login");
    expect(authErrorFor({ code: "user_already_exists" })).toBe("taken");
    expect(authErrorFor({ code: "weak_password" })).toBe("weak_password");
    expect(authErrorFor({ code: "email_address_invalid" })).toBe("bad_email");
  });

  it("falls back to a generic error", () => {
    expect(authErrorFor({ code: "over_request_rate_limit" })).toBe("failed");
    expect(authErrorFor({})).toBe("failed");
    expect(authErrorFor(null)).toBe("failed");
  });
});
