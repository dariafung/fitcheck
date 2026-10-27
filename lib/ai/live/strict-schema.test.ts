import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ExtractWire } from "./extract-item";
import { PairingWire } from "./judge-pairing";
import { RepeatWire } from "./judge-repeat";
import { FeelingWire } from "./parse-feeling";
import { ScoreWire } from "./score-purchase";
import { strictJsonSchema } from "./strict-schema";

// Meta's strict subset (dev.meta.ai/docs/structured-output): closed, fully
// required objects; no allOf / oneOf; anyOf only below the root.
function strictProblems(node: unknown, path = "$", root = true): string[] {
  if (Array.isArray(node)) return node.flatMap((n, i) => strictProblems(n, `${path}[${i}]`, false));
  if (node === null || typeof node !== "object") return [];
  const s = node as Record<string, unknown>;
  const problems: string[] = [];
  if ("allOf" in s || "oneOf" in s) problems.push(`${path}: allOf/oneOf`);
  if (root && ("anyOf" in s || s.type !== "object")) problems.push(`${path}: root must be a plain object`);
  if (Array.isArray(s.type)) problems.push(`${path}: type array`);
  if (s.type === "object") {
    const keys = Object.keys((s.properties as object) ?? {}).sort();
    if (s.additionalProperties !== false) problems.push(`${path}: additionalProperties`);
    if (JSON.stringify([...((s.required as string[]) ?? [])].sort()) !== JSON.stringify(keys)) {
      problems.push(`${path}: required`);
    }
  }
  for (const [key, value] of Object.entries(s)) {
    if (key === "properties") {
      for (const [name, prop] of Object.entries(value as object)) {
        problems.push(...strictProblems(prop, `${path}.${name}`, false));
      }
    } else if (typeof value === "object") {
      problems.push(...strictProblems(value, `${path}.${key}`, false));
    }
  }
  return problems;
}

describe("strictJsonSchema", () => {
  it.each([
    ["feeling", FeelingWire],
    ["pairings", PairingWire],
    ["item", ExtractWire],
    ["fit_answers", ScoreWire],
    ["repeat", RepeatWire],
  ])("%s fits the strict subset", (_, schema) => {
    expect(strictProblems(strictJsonSchema(schema))).toEqual([]);
  });

  it("turns nullable types into anyOf and drops safe-integer bounds", () => {
    const json = strictJsonSchema(z.strictObject({ a: z.string().nullable(), n: z.int() }));
    expect(json).toEqual({
      type: "object",
      properties: { a: { anyOf: [{ type: "string" }, { type: "null" }] }, n: { type: "integer" } },
      required: ["a", "n"],
      additionalProperties: false,
    });
  });
});
