"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
      const text = await transcribeRecording(itemId, wav);
      if (text === null) setMessage(FAILED);
      else if (text === "") setMessage("Didn't catch anything. Record again.");
      else onText(text);
    } catch {
      setMessage(FAILED);
    } finally {
      setState("idle");
    }
  }

  const label =
    state === "recording" ? "Release when done" : state === "working" ? "Turning it into text…" : "Hold to talk";

  return (
    <div className="flex flex-col items-start gap-1">
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
        className="flex touch-none items-center gap-2 rounded-full border border-black/15 px-4 py-1.5 text-sm font-medium select-none [-webkit-touch-callout:none] hover:bg-black/[.04] disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/[.06]"
      >
        <span
          aria-hidden
          className={`size-2 rounded-full ${state === "recording" ? "animate-pulse bg-red-600" : "bg-foreground/40"}`}
        />
        {label}
      </button>
      {state === "recording" && (
        <p role="status" className="text-sm tabular-nums text-foreground/60">
          {clock(elapsed)} / {clock(MAX_VOICE_SECONDS * 1000)}
        </p>
      )}
      {message && (
        <p role="alert" className="text-sm text-foreground/70">
          {message}
        </p>
      )}
    </div>
  );
}

// Upload straight to storage, then ask the server for the text. Null when any
// step fails.
async function transcribeRecording(itemId: string, wav: Uint8Array<ArrayBuffer>): Promise<string | null> {
  const upload = await fetch(`/api/items/${itemId}/feelings/voice/upload`, { method: "POST" });
  if (!upload.ok) return null;
  const { path, uploadUrl } = (await upload.json()) as { path: string; uploadUrl: string };

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "audio/wav" },
    body: new Blob([wav], { type: "audio/wav" }),
  });
  if (!put.ok) return null;

  const res = await fetch(`/api/items/${itemId}/feelings/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) return null;
  const { text } = (await res.json()) as { text: string };
  return text.trim();
}
