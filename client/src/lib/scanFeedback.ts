let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(frequencies: Array<{ freq: number; duration: number }>, volume = 0.12) {
  const ctx = getAudioContext();
  if (!ctx) return;

  void ctx.resume();
  let start = ctx.currentTime;

  for (const { freq, duration } of frequencies) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
    start += duration * 0.85;
  }
}

export function playScanSuccess() {
  playTone([
    { freq: 880, duration: 0.08 },
    { freq: 1175, duration: 0.12 },
  ]);
}

export function playScanError() {
  playTone([
    { freq: 220, duration: 0.12 },
    { freq: 180, duration: 0.16 },
  ], 0.14);
}
