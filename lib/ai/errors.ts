import type { z } from "zod";

// `status` is the HTTP status a Route Handler should answer with. Names are
// spelled out because minified production builds rename classes.
export class AiError extends Error {
  override name = "AiError";
  constructor(
    message: string,
    readonly fn: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class AiInputError extends AiError {
  override name = "AiInputError";
  constructor(
    fn: string,
    readonly issues: z.core.$ZodIssue[],
  ) {
    super(`${fn}: invalid input`, fn, 400);
  }
}

export class AiOutputError extends AiError {
  override name = "AiOutputError";
  constructor(
    fn: string,
    readonly issues: z.core.$ZodIssue[],
  ) {
    super(`${fn}: model output failed validation after retry`, fn, 502);
  }
}

export class AiReplayMissError extends AiError {
  override name = "AiReplayMissError";
  constructor(
    fn: string,
    readonly inputHash: string,
  ) {
    super(`${fn}: no replay recording for input ${inputHash}`, fn, 503);
  }
}

export class AiBudgetError extends AiError {
  override name = "AiBudgetError";
  constructor(fn: string) {
    super(`${fn}: daily AI budget reached`, fn, 429);
  }
}

// The model API itself failed (after the SDK's retry): network, 4xx or 5xx.
export class AiUpstreamError extends AiError {
  override name = "AiUpstreamError";
  constructor(
    fn: string,
    readonly upstreamStatus: number | undefined,
  ) {
    super(`${fn}: model API request failed (${upstreamStatus ?? "no response"})`, fn, 502);
  }
}

export class AiNotConfiguredError extends AiError {
  override name = "AiNotConfiguredError";
  constructor(fn: string, reason: string) {
    super(`${fn}: ${reason}`, fn, 503);
  }
}
