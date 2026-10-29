import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";
import { readLocalSupabase } from "./scripts/lib/local-supabase.mjs";

// The same production build with sign-in on (AUTH_REQUIRED=1), as on the
// hosted site. Run `pnpm build` first; runs on its own after `pnpm test:e2e`
// since both serve port 5129.
const PORT = 5129;
const { DEMO_ACCOUNT_PASSWORD } = parseEnv(readFileSync(".env.local", "utf8"));
if (!DEMO_ACCOUNT_PASSWORD) throw new Error("Run `pnpm env:local` first.");
process.env.DEMO_ACCOUNT_PASSWORD = DEMO_ACCOUNT_PASSWORD;

export default defineConfig({
  testDir: "tests/e2e/auth",
  globalSetup: "./tests/e2e/auth/global-setup.ts",
  workers: 3,
  forbidOnly: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "auth",
      use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--mute-audio"] } },
    },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: {
      ...readLocalSupabase(),
      AI_MODE: "mock",
      WEATHER_MODE: "fixed",
      NEXT_TELEMETRY_DISABLED: "1",
      AUTH_REQUIRED: "1",
      DEMO_ACCOUNT_PASSWORD,
    },
  },
});
