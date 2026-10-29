import type { NextRequest } from "next/server";
import { refreshSession } from "./lib/auth/proxy";

// Sign-in only (see lib/auth/proxy.ts); does nothing with AUTH_REQUIRED off.
export function proxy(request: NextRequest) {
  return refreshSession(request);
}

export const config = {
  // Skip Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|voice-worklet.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
