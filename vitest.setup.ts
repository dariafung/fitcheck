// console.warn / console.error fail the test unless the message is on the
// "test" allowlist in project.config.json.
import { afterEach, beforeEach, vi } from "vitest";
import { isAllowedWarning } from "./scripts/lib/warnings.mjs";

let unexpected: string[] = [];

beforeEach(() => {
  unexpected = [];
  for (const level of ["warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      const text = args.map(String).join(" ");
      if (!isAllowedWarning(text, "test")) unexpected.push(`console.${level}: ${text}`);
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  if (unexpected.length > 0) {
    throw new Error(`Unexpected console output:\n${unexpected.join("\n")}`);
  }
});
