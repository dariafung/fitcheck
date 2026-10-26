import { createHash } from "node:crypto";

export function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

// JSON with object keys sorted, so equal values always serialize the same.
export function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const entries = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

// Inline media is replaced by its content hash so keys stay short.
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value === null || typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  if (obj.kind === "inline" && typeof obj.base64 === "string") {
    return { kind: "inline", mime: obj.mime, sha256: sha256(obj.base64) };
  }
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, normalize(v)]),
  );
}

export function inputHash(
  fn: string,
  promptVersion: string,
  input: unknown,
): string {
  return sha256(stableStringify({ fn, promptVersion, input: normalize(input) }));
}
