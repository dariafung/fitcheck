import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * @typedef {"build" | "test" | "browser"} WarningScope
 * @typedef {{ scope: WarningScope, match: string, reason: string }} AllowedWarning
 */

/** @returns {AllowedWarning[]} */
function loadAllowlist() {
  const file = path.join(process.cwd(), "project.config.json");
  return JSON.parse(readFileSync(file, "utf8")).warningAllowlist;
}

/** "/pattern/flags" is a regex; anything else is a substring. */
function matches(text, match) {
  const regex = /^\/(.+)\/([a-z]*)$/.exec(match);
  return regex ? new RegExp(regex[1], regex[2]).test(text) : text.includes(match);
}

/**
 * Whether a warning is on the allowlist in project.config.json.
 * @param {string} text
 * @param {WarningScope} scope
 */
export function isAllowedWarning(text, scope) {
  return loadAllowlist().some(
    (entry) => entry.scope === scope && matches(text, entry.match),
  );
}

const ANSI = /\x1b\[[0-9;]*m/g;
const WARNING_LINE = /^\s*(⚠|warn\b|warning\b)/i;

/**
 * Warning lines in build output that are not on the "build" allowlist.
 * @param {string} output
 * @returns {string[]}
 */
export function unexpectedBuildWarnings(output) {
  return output
    .split("\n")
    .map((line) => line.replace(ANSI, "").trim())
    .filter((line) => WARNING_LINE.test(line) && !isAllowedWarning(line, "build"));
}
