import { inject, vi } from "vitest";
import { memoryUsageStore, setUsageStore } from "@/lib/limits/usage-store";

Object.assign(process.env, inject("supabaseEnv"));

// Route Handlers are called directly here, outside a Next.js request, where
// connection() would throw. It only opts a route out of prerendering.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

// Daily AI counts live in memory, per test file: runs never add up in the
// shared local database (tests/integration/limits/usage-db.test.ts covers
// the table itself).
setUsageStore(memoryUsageStore());
