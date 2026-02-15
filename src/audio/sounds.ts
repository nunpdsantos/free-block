let ctx: AudioContext | null = null;
let muted = false;

try {
  const stored = localStorage.getItem('gridlock-muted');
  if (stored === 'true') muted = true;
} catch { /* ignore */ }

function getCtx(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Haptic pulse — always fires (independent of sound mute) */
function vibrate(pattern: number | number[]) {
  try {
    navigator?.vibrate?.(pattern);
  } catch { /* unsupported */ }
}

export function isSoundMuted(): boolean {
  return muted;
}

export function setSoundMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('gridlock-muted', String(m));
  } catch { /* ignore */ }
}

// --- Sound effects ---

/** Warm pop on piece placement */
export function playPlace() {
  vibrate(8);

  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(500, t);
  osc.frequency.exponentialRampToValueAtTime(150, t + 0.05);

  gain.gain.setValueAtTime(0.13, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

  osc.start(t);
  osc.stop(t + 0.07);
}

/** Crystal chime on line clear — pitch rises with combo, richer on multi-clears */
export function playClear(combo: number = 0, linesCleared: number = 1) {
  vibrate(linesCleared >= 2 ? [15, 30, 15] : 15);

  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;

  const pitchMult = 1 + combo * 0.06;
  const baseFreqs = [800, 1200];
  const duration = linesCleared >= 2 ? 0.35 : 0.25;
  const volume = 0.08;

  // Main chord tones
  for (const freq of baseFreqs) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * pitchMult, t);

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.start(t);
    osc.stop(t + duration);
  }

  // Shimmer — slightly detuned high harmonic
  const shimmer = c.createOscillator();
  const shimmerGain = c.createGain();
  shimmer.connect(shimmerGain);
  shimmerGain.connect(c.destination);

  shimmer.type = 'sine';
  shimmer.frequency.setValueAtTime(1760 * pitchMult, t);
  shimmerGain.gain.setValueAtTime(0.025, t);
  shimmerGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.7);

  shimmer.start(t);
  shimmer.stop(t + duration * 0.7);

  // Extra sparkle for multi-line clears
  if (linesCleared >= 2) {
    const sparkle = c.createOscillator();
    const sparkleGain = c.createGain();
    sparkle.connect(sparkleGain);
    sparkleGain.connect(c.destination);

    sparkle.type = 'sine';
    sparkle.frequency.setValueAtTime(2400 * pitchMult, t + 0.05);
    sparkle.frequency.exponentialRampToValueAtTime(3200 * pitchMult, t + 0.15);

    sparkleGain.gain.setValueAtTime(0.02, t + 0.05);
    sparkleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    sparkle.start(t + 0.05);
    sparkle.stop(t + 0.3);
  }
}

/** Descending minor triad on game over */
export function playGameOver() {
  vibrate([40, 60, 80]);

  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;

  const notes = [330, 262, 196]; // E4, C4, G3

  for (let i = 0; i < notes.length; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);

    osc.type = 'sine';
    const noteTime = t + i * 0.16;
    osc.frequency.setValueAtTime(notes[i], noteTime);

    gain.gain.setValueAtTime(0, noteTime);
    gain.gain.linearRampToValueAtTime(0.1, noteTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.3);

    osc.start(noteTime);
    osc.stop(noteTime + 0.3);
  }
}
