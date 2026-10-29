// 16 kHz mono 16-bit PCM WAV, the format Voice Transcribe takes. Safe to
// import from client code.
export const VOICE_SAMPLE_RATE = 16_000;
export const MAX_VOICE_SECONDS = 180;
// Shorter presses are treated as a tap, not a recording.
export const MIN_VOICE_MS = 500;

const HEADER_BYTES = 44;

export function encodeWav(samples: Float32Array, sampleRate = VOICE_SAMPLE_RATE): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(HEADER_BYTES + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(HEADER_BYTES + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytes;
}

export interface WavInfo {
  format: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataBytes: number;
  durationMs: number;
}

// Reads the fmt and data chunks of a RIFF/WAVE file; null when it is not one.
export function readWavInfo(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;

  let fmt: Omit<WavInfo, "dataBytes" | "durationMs"> | null = null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt " && size >= 16 && body + 16 <= bytes.length) {
      fmt = {
        format: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      if (!fmt || fmt.sampleRate === 0 || fmt.channels === 0 || fmt.bitsPerSample === 0) return null;
      const dataBytes = Math.min(size, bytes.length - body);
      const bytesPerSecond = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8);
      return { ...fmt, dataBytes, durationMs: Math.round((dataBytes / bytesPerSecond) * 1000) };
    }
    offset = body + size + (size % 2);
  }
  return null;
}

// Why the server refuses an upload, or null when it is a voice recording it
// can send on. A second of slack covers the browser stopping a little late.
export function voiceWavProblem(bytes: Uint8Array): string | null {
  const info = readWavInfo(bytes);
  if (!info) return "not a WAV file";
  if (info.format !== 1 || info.channels !== 1 || info.bitsPerSample !== 16 || info.sampleRate !== VOICE_SAMPLE_RATE) {
    return "not 16 kHz mono 16-bit PCM";
  }
  if (info.dataBytes === 0) return "empty";
  if (info.durationMs > (MAX_VOICE_SECONDS + 1) * 1000) return "longer than 3 minutes";
  return null;
}
