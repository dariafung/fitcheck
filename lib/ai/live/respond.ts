import OpenAI from "openai";
import type {
  Response,
  ResponseIncludable,
  ResponseInputContent,
  Tool,
} from "openai/resources/responses/responses";
import type { z } from "zod";
import { costUsd, recordSpend } from "../budget";
import type { AiFunctionName } from "../define";
import { AiUpstreamError } from "../errors";
import { getClient } from "./client";
import { strictJsonSchema } from "./strict-schema";

// Standard mode only: contributor models may train on our data.
export const MODEL = "muse-spark-1.3";

export interface StructuredRequest<W extends z.ZodType> {
  fn: AiFunctionName;
  // Fixed per prompt version and sent first, so it can hit the prompt cache.
  instructions: string;
  content: ResponseInputContent[];
  schemaName: string;
  // Wire schema the model answers in; the live function maps it to the app shape.
  schema: W;
  // Covers reasoning plus the visible answer; also bounds the budget estimate.
  maxOutputTokens: number;
  timeoutMs: number;
  tools?: Tool[];
  include?: ResponseIncludable[];
}

export interface StructuredResult<T> {
  // Null when the answer was cut off or did not match the wire schema. The
  // live function then returns null, which fails runAi's check and retries.
  data: T | null;
  response: Response;
}

// One Responses API call with strict JSON output. Not stored on Meta's side;
// reasoning stays low until we tune for quality. The SDK retries a failed
// request once (429/5xx/timeouts); runAi handles bad answers.
export async function respondStructured<W extends z.ZodType>(
  req: StructuredRequest<W>,
): Promise<StructuredResult<z.output<W>>> {
  const client = await getClient(req.fn);
  let response: Response;
  try {
    response = await client.responses.create(
      {
        model: MODEL,
        instructions: req.instructions,
        input: [{ role: "user", content: req.content }],
        text: {
          format: {
            type: "json_schema",
            name: req.schemaName,
            schema: strictJsonSchema(req.schema),
            strict: true,
          },
        },
        reasoning: { effort: "low" },
        max_output_tokens: req.maxOutputTokens,
        store: false,
        ...(req.tools ? { tools: req.tools } : {}),
        ...(req.include ? { include: req.include } : {}),
      },
      { timeout: req.timeoutMs, maxRetries: 1 },
    );
  } catch (err) {
    if (err instanceof OpenAI.APIError) throw new AiUpstreamError(req.fn, err.status);
    throw err;
  }
  await recordSpend(costUsd(response.usage, countWebSearches(response)));
  return { data: parseStructured(response, req.schema), response };
}

export function parseStructured<W extends z.ZodType>(
  response: Response,
  schema: W,
): z.output<W> | null {
  if (response.status !== "completed") return null;
  let json: unknown;
  try {
    json = JSON.parse(outputText(response));
  } catch {
    return null;
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

// Joined from the output items rather than the SDK's convenience field.
export function outputText(response: Response): string {
  return response.output
    .flatMap((item) => (item.type === "message" ? item.content : []))
    .map((part) => (part.type === "output_text" ? part.text : ""))
    .join("");
}

// Billed per search query; usage has no field for it, so count the calls.
export function countWebSearches(response: Response): number {
  let count = 0;
  for (const item of response.output) {
    if (item.type !== "web_search_call") continue;
    const action = item.action as { type?: string; queries?: string[] } | undefined;
    if (!action) count += 1;
    else if (action.type === "search") count += Math.max(1, action.queries?.length ?? 0);
  }
  return count;
}
