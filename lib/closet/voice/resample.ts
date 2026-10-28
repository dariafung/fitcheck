// Downsamples microphone audio (usually 44.1 or 48 kHz) to the transcription
// rate: a windowed-sinc low-pass below the new Nyquist frequency, then linear
// interpolation at the new sample times. Plenty for speech. Safe to import
// from client code.
const TAPS = 33;

export function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array<ArrayBuffer> {
  if (fromRate === toRate) return Float32Array.from(input);
  if (fromRate < toRate) throw new Error(`cannot upsample ${fromRate} Hz to ${toRate} Hz`);

  const ratio = fromRate / toRate;
  const kernel = lowPass((0.45 * toRate) / fromRate);
  const half = (TAPS - 1) / 2;
  const last = input.length - 1;
  const filtered = (center: number) => {
    let sum = 0;
    for (let k = 0; k < TAPS; k++) {
      const i = Math.min(last, Math.max(0, center + k - half));
      sum += input[i] * kernel[k];
    }
    return sum;
  };

  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let n = 0; n < out.length; n++) {
    const t = n * ratio;
    const i = Math.floor(t);
    const frac = t - i;
    const a = filtered(i);
    out[n] = frac === 0 || i >= last ? a : a + (filtered(i + 1) - a) * frac;
  }
  return out;
}

// Blackman-windowed sinc with unit gain at 0 Hz; cutoff in cycles per sample.
function lowPass(cutoff: number): Float64Array {
  const kernel = new Float64Array(TAPS);
  const mid = (TAPS - 1) / 2;
  let sum = 0;
  for (let k = 0; k < TAPS; k++) {
    const x = k - mid;
    const sinc = x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x);
    const window = 0.42 - 0.5 * Math.cos((2 * Math.PI * k) / (TAPS - 1)) + 0.08 * Math.cos((4 * Math.PI * k) / (TAPS - 1));
    kernel[k] = sinc * window;
    sum += kernel[k];
  }
  for (let k = 0; k < TAPS; k++) kernel[k] /= sum;
  return kernel;
}
