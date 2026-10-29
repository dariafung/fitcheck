// Runs `next build` (which also type-checks) and fails on any warning that is
// not on the build allowlist in project.config.json, or when a server trace
// leaves out a replay recording.
import { spawn } from "node:child_process";
import { listFiles, tracesMissing } from "./lib/trace-check.mjs";
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
  // Replay recordings are read at request time; check every server route ships them.
  const root = process.cwd();
  const untraced = tracesMissing(root, listFiles(root, "fixtures/ai"));
  if (untraced.length > 0) {
    console.error("\nServer traces missing fixtures/ai files (outputFileTracingIncludes):");
    for (const { trace, missing } of untraced) console.error(`  ${trace}: ${missing.length} missing`);
    process.exit(1);
  }
});
