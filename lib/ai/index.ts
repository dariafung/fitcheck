// The only entry point for model calls. Import from Route Handlers only.
import { defineAiFunction } from "./define";
import { liveBuildProfile } from "./live/build-profile";
import { liveExtractItem } from "./live/extract-item";
import { liveJudgePairing } from "./live/judge-pairing";
import { liveJudgeRepeat } from "./live/judge-repeat";
import { notImplemented } from "./live/not-implemented";
import { liveParseFeeling } from "./live/parse-feeling";
import { liveScorePurchase } from "./live/score-purchase";
import { liveTranscribe } from "./live/transcribe";
import { mockBuildProfile } from "./mock/build-profile";
import { mockExtractItem } from "./mock/extract-item";
import { mockJudgePairing } from "./mock/judge-pairing";
import { mockJudgeRepeat } from "./mock/judge-repeat";
import { mockParseFeeling } from "./mock/parse-feeling";
import { mockRenderOutfit } from "./mock/render-outfit";
import { mockScorePurchase } from "./mock/score-purchase";
import { mockSegmentGarment } from "./mock/segment-garment";
import { mockTranscribe } from "./mock/transcribe";
import * as buildProfileSchema from "./schemas/build-profile";
import * as extractItemSchema from "./schemas/extract-item";
import * as judgePairingSchema from "./schemas/judge-pairing";
import * as judgeRepeatSchema from "./schemas/judge-repeat";
import * as parseFeelingSchema from "./schemas/parse-feeling";
import * as renderOutfitSchema from "./schemas/render-outfit";
import * as scorePurchaseSchema from "./schemas/score-purchase";
import * as segmentGarmentSchema from "./schemas/segment-garment";
import * as transcribeSchema from "./schemas/transcribe";

// A missing answer or out-of-range score is asked again up to 3 times.
const SCORING_ATTEMPTS = 4;

export const extractItem = defineAiFunction({
  name: "extractItem",
  promptVersion: extractItemSchema.PROMPT_VERSION,
  input: extractItemSchema.ExtractItemInput,
  output: extractItemSchema.ExtractItemOutput,
  mock: mockExtractItem,
  live: liveExtractItem,
});

export const parseFeeling = defineAiFunction({
  name: "parseFeeling",
  promptVersion: parseFeelingSchema.PROMPT_VERSION,
  input: parseFeelingSchema.ParseFeelingInput,
  output: parseFeelingSchema.ParseFeelingOutput,
  mock: mockParseFeeling,
  live: liveParseFeeling,
});

export const transcribe = defineAiFunction({
  name: "transcribe",
  promptVersion: transcribeSchema.PROMPT_VERSION,
  input: transcribeSchema.TranscribeInput,
  output: transcribeSchema.TranscribeOutput,
  mock: mockTranscribe,
  live: liveTranscribe,
});

export const judgePairing = defineAiFunction({
  name: "judgePairing",
  promptVersion: judgePairingSchema.PROMPT_VERSION,
  input: judgePairingSchema.JudgePairingInput,
  output: judgePairingSchema.JudgePairingOutput,
  mock: mockJudgePairing,
  live: liveJudgePairing,
});

export const judgeRepeat = defineAiFunction({
  name: "judgeRepeat",
  promptVersion: judgeRepeatSchema.PROMPT_VERSION,
  input: judgeRepeatSchema.JudgeRepeatInput,
  output: judgeRepeatSchema.JudgeRepeatOutput,
  mock: mockJudgeRepeat,
  live: liveJudgeRepeat,
  liveAttempts: SCORING_ATTEMPTS,
});

export const scorePurchase = defineAiFunction({
  name: "scorePurchase",
  promptVersion: scorePurchaseSchema.PROMPT_VERSION,
  input: scorePurchaseSchema.ScorePurchaseInput,
  output: scorePurchaseSchema.ScorePurchaseOutput,
  mock: mockScorePurchase,
  live: liveScorePurchase,
  liveAttempts: SCORING_ATTEMPTS,
});

export const renderOutfit = defineAiFunction({
  name: "renderOutfit",
  promptVersion: renderOutfitSchema.PROMPT_VERSION,
  input: renderOutfitSchema.RenderOutfitInput,
  output: renderOutfitSchema.RenderOutfitOutput,
  mock: mockRenderOutfit,
  live: notImplemented("renderOutfit"),
});

export const buildProfile = defineAiFunction({
  name: "buildProfile",
  promptVersion: buildProfileSchema.PROMPT_VERSION,
  input: buildProfileSchema.BuildProfileInput,
  output: buildProfileSchema.BuildProfileOutput,
  mock: mockBuildProfile,
  live: liveBuildProfile,
});

export const segmentGarment = defineAiFunction({
  name: "segmentGarment",
  promptVersion: segmentGarmentSchema.PROMPT_VERSION,
  input: segmentGarmentSchema.SegmentGarmentInput,
  output: segmentGarmentSchema.SegmentGarmentOutput,
  mock: mockSegmentGarment,
  live: notImplemented("segmentGarment"),
});

export { AiError } from "./errors";
export { aiErrorResponse } from "./http";
export { currentMode, type AiMode } from "./mode";
export type { RunOptions } from "./run";
export type * from "./schemas/common";
export type { BuildProfileInput, BuildProfileOutput } from "./schemas/build-profile";
export type { ExtractItemInput, ExtractItemOutput } from "./schemas/extract-item";
export type { JudgePairingInput, JudgePairingOutput } from "./schemas/judge-pairing";
export type { JudgeRepeatInput, JudgeRepeatOutput } from "./schemas/judge-repeat";
export type { ParseFeelingInput, ParseFeelingOutput } from "./schemas/parse-feeling";
export type { RenderOutfitInput, RenderOutfitOutput } from "./schemas/render-outfit";
export type { ScorePurchaseInput, ScorePurchaseOutput } from "./schemas/score-purchase";
export type { SegmentGarmentInput, SegmentGarmentOutput } from "./schemas/segment-garment";
export type { TranscribeInput, TranscribeOutput } from "./schemas/transcribe";
