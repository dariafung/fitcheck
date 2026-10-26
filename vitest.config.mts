import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    // Tests never reach a real model.
    env: { AI_MODE: "mock" },
    setupFiles: [path.join(root, "vitest.setup.ts")],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["{app,lib,components,scripts,seed}/**/*.test.ts"],
          environment: "node",
          maxWorkers: 4,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // One shared local Supabase instance: run files one at a time.
          fileParallelism: false,
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/env-setup.ts"],
        },
      },
    ],
  },
});
