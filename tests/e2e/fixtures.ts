import { test as base, expect } from "@playwright/test";
import { isAllowedWarning } from "../../scripts/lib/warnings.mjs";

// Every test fails on browser errors, and on warnings that are not on the
// "browser" allowlist in project.config.json.
export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (msg) => {
        const type = msg.type();
        if (type === "error" || (type === "warning" && !isAllowedWarning(msg.text(), "browser"))) {
          problems.push(`console.${type}: ${msg.text()}`);
        }
      });
      page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
      await use();
      expect(problems, "browser console").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
