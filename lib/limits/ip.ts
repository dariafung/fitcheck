import { createHash } from "node:crypto";
import { headers } from "next/headers";

// The caller's IP, hashed, for counting sign-ups; null where the IP can't be
// trusted. On Vercel the platform sets x-real-ip / x-forwarded-for itself;
// elsewhere (local dev, the e2e server) any client can send them, and every
// local request comes from the same address anyway.
export async function signupIpHash(): Promise<string | null> {
  if (process.env.VERCEL !== "1") return null;
  const all = await headers();
  const ip = all.get("x-real-ip") ?? all.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip ? hashIp(ip) : null;
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`fitcheck-signup:${ip}`).digest("hex");
}
