"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { aiNotice, isAiFailure } from "@/lib/ai/notices";
import {
  micError,
  startRecording,
  voiceSupported,
  type ActiveRecording,
  type MicError,
} from "@/lib/closet/voice/recorder";
import { MAX_VOICE_SECONDS, MIN_VOICE_MS } from "@/lib/closet/voice/wav";

type State = "idle" | "starting" | "recording" | "working";

const MIC_MESSAGES: Record<MicError, string> = {
  blocked: "Mic is blocked. Allow it in your browser settings.",
  "no-mic": "No mic found.",
  failed: "Couldn't start the mic. Try again.",
};
const FAILED = "Couldn't hear that. Record again.";
const AI_FAILED = "Couldn't turn that into text. Try again?";

const noSubscribe = () => () => {};

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Hold to talk (mouse, touch, or Space / Enter while focused). On release the
// recording is uploaded and transcribed, and the text handed to onText.
// Hidden where the browser cannot record.
export function VoiceButton({ itemId, onText }: { itemId: string; onText: (text: string) => void }) {
  const supported = useSyncExternalStore(noSubscribe, voiceSupported, () => false);
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const held = useRef(false);
  const active = useRef<ActiveRecording | null>(null);

  useEffect(() => () => active.current?.cancel(), []);

  if (!supported) return null;

  async function press() {
    if (state !== "idle") return;
    held.current = true;
    setMessage(null);
    setElapsed(0);
    setState("starting");
    let recording: ActiveRecording;
    try {
      recording = await startRecording({ onTick: setElapsed, onEnd: () => void finish() });
    } catch (err) {
      setMessage(MIC_MESSAGES[micError(err)]);
      setState("idle");
      return;
    }
    if (!held.current) {
      // Let go while the browser was asking for the mic.
      recording.cancel();
      setMessage("Mic is on. Hold to talk.");
      setState("idle");
      return;
    }
    active.current = recording;
    setState("recording");
  }

  function release() {
    held.current = false;
    void finish();
  }

  async function finish() {
    const recording = active.current;
    if (!recording) return;
    active.current = null;
    setState("working");
    try {
      const { wav, durationMs } = await recording.stop();
      if (durationMs < MIN_VOICE_MS) {
        setMessage("Hold a bit longer.");
        return;
      }
      const result = await transcribeRecording(itemId, wav);
      if ("text" in result) {
        if (result.text === "") setMessage("Didn't catch anything. Record again.");
        else onText(result.text);
      } else {
        setMessage(aiNotice(result.error) ?? (isAiFailure(result.error) ? AI_FAILED : FAILED));
      }
    } catch {
      setMessage(FAILED);
    } finally {
      setState("idle");
    }
  }

  const label =
    state === "recording" ? "Release when done" : state === "working" ? "Turning it into text…" : "Hold to talk";

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={state === "working"}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          void press();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            void press();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") release();
        }}
        className="btn-secondary touch-none select-none [-webkit-touch-callout:none] data-[state=recording]:bg-ink data-[state=recording]:text-paper"
        data-state={state}
      >
        <span
          aria-hidden
          className={`size-2 rounded-full ${state === "recording" ? "bg-paper motion-safe:animate-pulse" : "bg-ink"}`}
        />
        {label}
      </button>
      {state === "recording" && (
        <p role="status" className="text-sm tabular-nums text-ink-2">
          {clock(elapsed)} / {clock(MAX_VOICE_SECONDS * 1000)}
        </p>
      )}
      {message && (
        <p role="alert" className="text-sm font-medium">
          {message}
        </p>
      )}
    </div>
  );
}

type Transcript = { text: string } | { error?: string };

// The `error` name a failed API call answered with, if any.
async function errorOf(res: Response): Promise<{ error?: string }> {
  const json = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof json?.error === "string" ? { error: json.error } : {};
}

// Upload straight to storage, then ask the server for the text. On failure,
// the `error` name from our API when there is one.
async function transcribeRecording(itemId: string, wav: Uint8Array<ArrayBuffer>): Promise<Transcript> {
  const upload = await fetch(`/api/items/${itemId}/feelings/voice/upload`, { method: "POST" });
  if (!upload.ok) return errorOf(upload);
  const { path, uploadUrl } = (await upload.json()) as { path: string; uploadUrl: string };

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "audio/wav" },
    body: new Blob([wav], { type: "audio/wav" }),
  });
  if (!put.ok) return {};

  const res = await fetch(`/api/items/${itemId}/feelings/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) return errorOf(res);
  const { text } = (await res.json()) as { text: string };
  return { text: text.trim() };
}
