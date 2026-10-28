import { downsample } from "./resample";
import { encodeWav, MAX_VOICE_SECONDS, VOICE_SAMPLE_RATE } from "./wav";

// Browser side of voice feelings: microphone → AudioWorklet (raw samples at
// the device rate) → 16 kHz WAV when stopped. Works the same in Chrome and
// Safari, with no codec in between.

const WORKLET_URL = "/voice-worklet.js";

export interface Recording {
  wav: Uint8Array<ArrayBuffer>;
  durationMs: number;
}

export interface ActiveRecording {
  stop(): Promise<Recording>;
  cancel(): void;
}

export interface RecordOptions {
  // Seconds recorded so far, a few times a second.
  onTick(ms: number): void;
  // Reached MAX_VOICE_SECONDS, or the microphone went away (iOS does this
  // when the page goes to the background or a call comes in). The caller
  // should stop and keep what was recorded.
  onEnd(): void;
}

export type MicError = "blocked" | "no-mic" | "failed";

export function voiceSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof AudioContext === "function" &&
    typeof AudioWorkletNode === "function"
  );
}

export function micError(err: unknown): MicError {
  const name = (err as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "blocked";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no-mic";
  return "failed";
}

// Call straight from the press handler: Safari only lets an AudioContext run
// when it is created and resumed inside the user's gesture.
export async function startRecording({ onTick, onEnd }: RecordOptions): Promise<ActiveRecording> {
  const ctx = new AudioContext();
  const resumed = ctx.resume();
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    await resumed;
    await ctx.audioWorklet.addModule(WORKLET_URL);
  } catch (err) {
    stream?.getTracks().forEach((t) => t.stop());
    void ctx.close();
    throw err;
  }

  const rate = ctx.sampleRate;
  const limit = MAX_VOICE_SECONDS * rate;
  const chunks: Float32Array[] = [];
  let received = 0;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    onEnd();
  };

  const source = ctx.createMediaStreamSource(stream);
  const capture = new AudioWorkletNode(ctx, "voice-capture");
  // Some browsers only run a node that leads to the output; keep it silent.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(capture).connect(mute).connect(ctx.destination);

  capture.port.onmessage = (event: MessageEvent<Float32Array | string>) => {
    if (typeof event.data === "string" || received >= limit) return;
    chunks.push(event.data);
    received += event.data.length;
    if (received >= limit) end();
  };
  const ticker = setInterval(() => onTick(Math.min(received, limit) / rate * 1000), 250);
  for (const track of stream.getAudioTracks()) track.addEventListener("ended", end);

  const release = () => {
    clearInterval(ticker);
    for (const track of stream.getTracks()) {
      track.removeEventListener("ended", end);
      track.stop();
    }
    source.disconnect();
    capture.disconnect();
    void ctx.close();
  };

  return {
    async stop() {
      // Take the samples still waiting in the worklet's block.
      const flushed = new Promise<void>((resolve) => {
        capture.port.addEventListener("message", (e) => e.data === "flushed" && resolve());
      });
      capture.port.postMessage("flush");
      await Promise.race([flushed, new Promise((r) => setTimeout(r, 500))]);
      release();

      const all = new Float32Array(Math.min(received, limit));
      let offset = 0;
      for (const chunk of chunks) {
        if (offset >= all.length) break;
        const part = chunk.subarray(0, all.length - offset);
        all.set(part, offset);
        offset += part.length;
      }
      const samples = downsample(all, rate, VOICE_SAMPLE_RATE);
      return { wav: encodeWav(samples), durationMs: Math.round((samples.length / VOICE_SAMPLE_RATE) * 1000) };
    },
    cancel: release,
  };
}
