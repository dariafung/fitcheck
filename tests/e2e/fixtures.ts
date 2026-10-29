import { test as base, expect } from "@playwright/test";
import { isAllowedWarning } from "../../scripts/lib/warnings.mjs";

// Chrome's own line for any 4xx/5xx response. The page explains those errors,
// so they aren't bugs.
const HTTP_ERROR_STATUS = /^Failed to load resource: the server responded with a status of [45]\d\d\b/;

// Every test fails on browser errors (except HTTP_ERROR_STATUS), and on
// warnings that are not on the "browser" allowlist in project.config.json.
export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (msg) => {
        const type = msg.type();
        if (type === "error" && HTTP_ERROR_STATUS.test(msg.text())) return;
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
