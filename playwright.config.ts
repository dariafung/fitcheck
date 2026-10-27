import { defineConfig, devices } from "@playwright/test";
import { readLocalSupabase } from "./scripts/lib/local-supabase.mjs";

// Serves the existing production build: run `pnpm build` first.
const PORT = 5129;
const PROFILE_SPEC = /closet\/profile\.spec\.ts$/;
const CHROME = { ...devices["Desktop Chrome"], launchOptions: { args: ["--mute-audio"] } };

export default defineConfig({
  testDir: "tests/e2e",
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
      name: "chromium",
      testIgnore: PROFILE_SPEC,
      use: CHROME,
    },
    // Writes the shared demo persona's profile, so it runs after everything
    // else that reads it.
    {
      name: "profile",
      testMatch: PROFILE_SPEC,
      dependencies: ["chromium"],
      use: CHROME,
    },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: { ...readLocalSupabase(), AI_MODE: "mock", WEATHER_MODE: "fixed", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
