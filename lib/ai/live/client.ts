import OpenAI from "openai";
import { AiNotConfiguredError } from "../errors";
import { getMetaApiKey } from "./key";

export const META_API_BASE_URL = "https://api.meta.ai/v1";

let client: OpenAI | undefined;

// Shared client for the Meta Model API (Responses API via the openai SDK).
export async function getClient(fn: string): Promise<OpenAI> {
  if (client) return client;
  const apiKey = await getMetaApiKey();
  if (!apiKey) throw new AiNotConfiguredError(fn, "no Meta API key found");
  client = new OpenAI({ apiKey, baseURL: META_API_BASE_URL });
  return client;
}
