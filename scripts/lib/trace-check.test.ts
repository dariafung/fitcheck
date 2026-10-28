import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listFiles, tracesMissing } from "./trace-check.mjs";

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "fitcheck-trace-"));
  mkdirSync(path.join(root, "fixtures/ai/judgePairing"), { recursive: true });
  writeFileSync(path.join(root, "fixtures/ai/judgePairing/a.json"), "{}");
  writeFileSync(path.join(root, "fixtures/ai/judgePairing/b.json"), "{}");
  mkdirSync(path.join(root, ".next/server/app/api/checks"), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function trace(route: string, files: string[]) {
  writeFileSync(path.join(root, ".next/server/app", `${route}.nft.json`), JSON.stringify({ version: 1, files }));
}

describe("tracesMissing", () => {
  it("lists the fixtures each route trace leaves out", () => {
    const fixtures = listFiles(root, "fixtures/ai");
    expect(fixtures.sort()).toEqual(["fixtures/ai/judgePairing/a.json", "fixtures/ai/judgePairing/b.json"]);
    // Trace paths are relative to the trace file.
    trace("api/checks/route.js", ["../../../../../fixtures/ai/judgePairing/a.json", "../../../../../fixtures/ai/judgePairing/b.json"]);
    trace("page.js", ["../../../fixtures/ai/judgePairing/a.json"]);
    expect(tracesMissing(root, fixtures)).toEqual([{ trace: "page.js.nft.json", missing: ["fixtures/ai/judgePairing/b.json"] }]);
  });

  it("fails when there is no build to check", () => {
    rmSync(path.join(root, ".next/server/app"), { recursive: true });
    mkdirSync(path.join(root, ".next/server/app"));
    expect(() => tracesMissing(root, [])).toThrow(/run next build first/);
  });
});
