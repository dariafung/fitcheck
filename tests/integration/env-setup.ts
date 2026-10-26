import { inject, vi } from "vitest";

Object.assign(process.env, inject("supabaseEnv"));

// Route Handlers are called directly here, outside a Next.js request, where
// connection() would throw. It only opts a route out of prerendering.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
