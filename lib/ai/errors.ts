import type { z } from "zod";

// `status` is the HTTP status a Route Handler should answer with.
export class AiError extends Error {
  constructor(
    message: string,
    readonly fn: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class AiInputError extends AiError {
  constructor(
    fn: string,
    readonly issues: z.core.$ZodIssue[],
  ) {
    super(`${fn}: invalid input`, fn, 400);
  }
}

export class AiOutputError extends AiError {
  constructor(
    fn: string,
    readonly issues: z.core.$ZodIssue[],
  ) {
    super(`${fn}: model output failed validation after retry`, fn, 502);
  }
}

export class AiReplayMissError extends AiError {
  constructor(
    fn: string,
    readonly inputHash: string,
  ) {
    super(`${fn}: no replay recording for input ${inputHash}`, fn, 503);
  }
}

export class AiBudgetError extends AiError {
  constructor(fn: string) {
    super(`${fn}: daily AI budget reached`, fn, 429);
  }
}

// The model API itself failed (after the SDK's retry): network, 4xx or 5xx.
export class AiUpstreamError extends AiError {
  constructor(
    fn: string,
    readonly upstreamStatus: number | undefined,
  ) {
    super(`${fn}: model API request failed (${upstreamStatus ?? "no response"})`, fn, 502);
  }
}

export class AiNotConfiguredError extends AiError {
  constructor(fn: string, reason: string) {
    super(`${fn}: ${reason}`, fn, 503);
  }
}
