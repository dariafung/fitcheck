import { AiDailyLimitError, AiError } from "./errors";

// Turns an AI-layer error into a JSON response; rethrows anything else.
export function aiErrorResponse(err: unknown): Response {
  if (!(err instanceof AiError)) throw err;
  return Response.json(
    { error: err.name, message: err.message },
    {
      status: err.status,
      // Daily counts reset at the next Chicago midnight.
      ...(err instanceof AiDailyLimitError && { headers: { "Retry-After": String(err.retryAfterSeconds) } }),
    },
  );
}
