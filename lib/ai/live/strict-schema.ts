import { z } from "zod";

// JSON Schema for Meta's strict structured output: every object closed and
// fully required (build wire schemas with z.strictObject and .nullable()).
// Type arrays such as ["string", "null"] become anyOf, which the docs list as
// supported below the root, and zod's default safe-integer bounds are dropped.
export function strictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return tidy(json) as Record<string, unknown>;
}

function tidy(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(tidy);
  if (node === null || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    const safeBound =
      (key === "minimum" || key === "maximum") &&
      Math.abs(value as number) === Number.MAX_SAFE_INTEGER;
    if (!safeBound) out[key] = tidy(value);
  }
  if (Array.isArray(out.type)) {
    const { type, ...rest } = out;
    return {
      anyOf: (type as string[]).map((t) => (t === "null" ? { type: "null" } : { ...rest, type: t })),
    };
  }
  return out;
}
