import { z } from "zod";

export const AiMode = z.enum(["mock", "live", "replay"]);
export type AiMode = z.infer<typeof AiMode>;

export function currentMode(): AiMode {
  return AiMode.parse(process.env.AI_MODE || "mock");
}

// In live mode, AI_RECORD=1 also writes each response to the replay store.
export function recordEnabled(): boolean {
  return process.env.AI_RECORD === "1";
}
