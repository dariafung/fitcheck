import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authEnv } from "./config";

// Supabase Auth for this request, with the session kept in cookies. Server
// Components can't set cookies, so writes there are dropped; Server Actions
// and Route Handlers keep them.
export async function createAuthClient() {
  const jar = await cookies();
  const env = authEnv();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // Called from a Server Component.
        }
      },
    },
  });
}
