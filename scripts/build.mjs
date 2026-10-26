// Runs `next build` (which also type-checks) and fails on any warning that is
// not on the build allowlist in project.config.json.
import { spawn } from "node:child_process";
import { unexpectedBuildWarnings } from "./lib/warnings.mjs";

const child = spawn("next", ["build"], { stdio: ["inherit", "pipe", "pipe"] });

let output = "";
child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  output += chunk;
});
child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  output += chunk;
});

child.on("close", (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const warnings = unexpectedBuildWarnings(output);
  if (warnings.length > 0) {
    console.error("\nBuild warnings not on the allowlist (project.config.json):");
    for (const line of warnings) console.error(`  ${line}`);
    process.exit(1);
  }
});
