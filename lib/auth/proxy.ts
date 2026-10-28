import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authEnv, authRequired } from "./config";

// Pages anyone can open. API routes are never redirected: they answer for
// themselves (the cron route checks its own secret).
const PUBLIC_PAGES = ["/login", "/signup"];

export function needsSignIn(pathname: string): boolean {
  if (pathname === "/api" || pathname.startsWith("/api/")) return false;
  return !PUBLIC_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
}

// With sign-in on: refresh the Supabase session cookies on every request,
// and send signed-out visitors from app pages to /login. Off, it does nothing.
export async function refreshSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  if (!authRequired()) return response;

  const env = authEnv();
  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // getClaims refreshes an expired token through setAll above.
  const { data } = await supabase.auth.getClaims();
  if (data?.claims || !needsSignIn(request.nextUrl.pathname)) return response;

  const redirect = NextResponse.redirect(new URL("/login", request.url));
  // Keep cookies the refresh cleared or set.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
