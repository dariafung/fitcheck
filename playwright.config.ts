import { defineConfig, devices } from "@playwright/test";
import { readLocalSupabase } from "./scripts/lib/local-supabase.mjs";

// Serves the existing production build: run `pnpm build` first.
const PORT = 5129;

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
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--mute-audio"] },
      },
    },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: { ...readLocalSupabase(), AI_MODE: "mock", WEATHER_MODE: "fixed", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
