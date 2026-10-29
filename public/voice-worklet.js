// Audio thread half of lib/closet/voice/recorder.ts: passes the microphone's
// first channel to the page in blocks, as plain Float32 samples. Plain JS
// because audioWorklet.addModule loads it as is.
const BLOCK = 4096;

class VoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.block = new Float32Array(BLOCK);
    this.length = 0;
    this.port.onmessage = (event) => {
      if (event.data !== "flush") return;
      this.send();
      this.port.postMessage("flushed");
    };
  }

  send() {
    if (this.length === 0) return;
    const samples = this.block.slice(0, this.length);
    this.port.postMessage(samples, [samples.buffer]);
    this.length = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.block[this.length++] = channel[i];
        if (this.length === BLOCK) this.send();
      }
    }
    return true;
  }
}

registerProcessor("voice-capture", VoiceCapture);
