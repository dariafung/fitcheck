import { describe, expect, it } from "vitest";
import { DEMO_READ_ONLY } from "../auth/messages";
import { AiBudgetError, AiNotConfiguredError, AiOutputError, AiReplayMissError, AiUpstreamError } from "./errors";
import { AI_BUDGET_NOTICE, aiNotice, isAiFailure } from "./notices";

describe("aiNotice", () => {
  it("names the spent budget", () => {
    expect(aiNotice(new AiBudgetError("extractItem").name)).toBe(AI_BUDGET_NOTICE);
  });

  it("names the read-only demo account", () => {
    expect(aiNotice("demo_read_only")).toBe(DEMO_READ_ONLY);
  });

  it("leaves everything else to the page", () => {
    expect(aiNotice(new AiOutputError("extractItem", []).name)).toBeUndefined();
    expect(aiNotice("unrecognized")).toBeUndefined();
    expect(aiNotice(undefined)).toBeUndefined();
  });
});

describe("isAiFailure", () => {
  it("is true for a failed or unreachable model", () => {
    for (const err of [
      new AiOutputError("transcribe", []),
      new AiUpstreamError("transcribe", 500),
      new AiReplayMissError("transcribe", "abc"),
      new AiNotConfiguredError("transcribe", "no key"),
    ]) {
      expect(isAiFailure(err.name)).toBe(true);
    }
  });

  it("is false for the budget, read-only and other errors", () => {
    expect(isAiFailure("AiBudgetError")).toBe(false);
    expect(isAiFailure("demo_read_only")).toBe(false);
    expect(isAiFailure(undefined)).toBe(false);
  });
});
