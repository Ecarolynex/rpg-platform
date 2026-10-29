// Web Audio API procedural sound effects for Ancient Parchment Scroll unrolling,
// rolling up, section transitions, and wax seal completion.
// Safely no-ops in test environments (jsdom) or when AudioContext is blocked.

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    return new AudioCtx();
  } catch {
    return null;
  }
}

export function playScrollUnrollSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const duration = 0.42;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const progress = i / bufferSize;
      // Rustling envelope with two gentle waves simulating ribbon slip + parchment unroll
      const wave =
        Math.sin(progress * Math.PI) * (0.7 + 0.3 * Math.sin(progress * Math.PI * 3));
      data[i] = (Math.random() * 2 - 1) * wave * 0.16;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(620, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1150, ctx.currentTime + duration * 0.6);
    filter.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + duration);
    filter.Q.value = 1.25;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
    noise.stop(ctx.currentTime + duration);
    noise.onended = () => {
      void ctx.close().catch(() => {});
    };
  } catch {
    void ctx.close().catch(() => {});
  }
}

export function playScrollRollUpSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const duration = 0.36;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const progress = i / bufferSize;
      const env = Math.sin(progress * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env * 0.15;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1080, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + duration);
    filter.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
    noise.stop(ctx.currentTime + duration);
    noise.onended = () => {
      void ctx.close().catch(() => {});
    };
  } catch {
    void ctx.close().catch(() => {});
  }
}

export function playPageFlipSound() {
  playScrollUnrollSound();
}

export function playMagicSealSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const freqs = [293.66, 440, 587.33, 880]; // D4, A4, D5, A5 medieval fifth chord

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0.001, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.06, now + idx * 0.04 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.75);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.04);
      osc.stop(now + 0.78);
      if (idx === freqs.length - 1) {
        osc.onended = () => {
          void ctx.close().catch(() => {});
        };
      }
    });
  } catch {
    void ctx.close().catch(() => {});
  }
}
