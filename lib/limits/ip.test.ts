import { afterEach, describe, expect, it, vi } from "vitest";
import { hashIp, signupIpHash } from "./ip";

const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));

afterEach(() => {
  vi.unstubAllEnvs();
  request.headers = new Headers();
});

describe("signupIpHash", () => {
  it("hashes the IP Vercel saw", async () => {
    vi.stubEnv("VERCEL", "1");
    request.headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(await signupIpHash()).toBe(hashIp("203.0.113.7"));
    request.headers = new Headers({ "x-real-ip": "198.51.100.2", "x-forwarded-for": "203.0.113.7" });
    expect(await signupIpHash()).toBe(hashIp("198.51.100.2"));
  });

  it("trusts no header off Vercel", async () => {
    vi.stubEnv("VERCEL", "");
    request.headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
    expect(await signupIpHash()).toBeNull();
  });

  it("never keeps the IP itself", () => {
    expect(hashIp("203.0.113.7")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("203.0.113.7")).not.toContain("203.0.113.7");
  });
});
