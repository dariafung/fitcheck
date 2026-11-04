"use client";

import { useEffect, useState } from "react";
import { CUTTING_OUT } from "./messages";

// What a model call is doing, for the waits people sit through. `seconds` is
// about how long it takes (measured on the hosted model); each step shows
// from `at` seconds on. Time-based, not real progress: the calls don't report
// any, so the bar slows down and never reaches the end by itself.
export const AI_WAITS = {
  read: {
    seconds: 20,
    steps: [
      { at: 0, text: "Reading your screenshot…" },
      { at: 5, text: "Looking up the material and fit online…" },
      { at: 14, text: "Filling in the details…" },
      { at: 28, text: "Taking longer than usual, still working…" },
    ],
  },
  cutOut: {
    seconds: 10,
    steps: [
      { at: 0, text: CUTTING_OUT },
      { at: 6, text: "Cleaning up the photo…" },
      { at: 20, text: "Taking longer than usual, still working…" },
    ],
  },
  check: {
    seconds: 15,
    steps: [
      { at: 0, text: "Checking it against your closet…" },
      { at: 4, text: "Working out which outfits it makes…" },
      { at: 8, text: "Comparing it with how your clothes feel…" },
      { at: 22, text: "Taking longer than usual, still working…" },
    ],
  },
} as const;

export type AiWaitName = keyof typeof AI_WAITS;

// How far the bar is after `elapsed` seconds, 0–1: about 85% at the usual
// time, then slower and slower.
export function waitProgress(elapsed: number, seconds: number): number {
  return Math.min(0.97, 1 - Math.exp((-1.9 * elapsed) / seconds));
}

export function waitText(name: AiWaitName, elapsed: number): string {
  const { steps } = AI_WAITS[name];
  return steps.findLast((s) => elapsed >= s.at)?.text ?? steps[0].text;
}

const TICK_MS = 250;

// The current step and a thin bar. Put it inside a live region to have the
// steps read out.
export function AiWait({ name }: { name: AiWaitName }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex w-full max-w-sm flex-col gap-2" data-testid="ai-wait">
      <span className="text-sm text-ink-2">{waitText(name, elapsed)}</span>
      <div aria-hidden className="h-0.5 w-full overflow-hidden bg-line">
        <div
          className="h-full origin-left bg-ink transition-transform duration-300 ease-linear"
          style={{ transform: `scaleX(${waitProgress(elapsed, AI_WAITS[name].seconds)})` }}
        />
      </div>
    </div>
  );
}
