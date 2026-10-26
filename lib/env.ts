import { z } from "zod";

// Server-only settings. Nothing here may use the NEXT_PUBLIC_ prefix.
const ServerEnv = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
});
export type ServerEnv = z.infer<typeof ServerEnv>;

export function serverEnv(): ServerEnv {
  return ServerEnv.parse(process.env);
}
