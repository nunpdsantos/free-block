/**
 * Generative ambient music engine.
 *
 * Brian Eno-style: overlapping tones with coprime cycle lengths
 * that create ever-changing but always-consonant patterns.
 * Reactive to game tension and streak. Zero bundle size — all
 * synthesized via Web Audio API.
 *
 * Routing: voices → voiceGain → ambientGain → masterGain → destination
 */

import { getCtx, getMaster } from './synth';

// ─── Frequency table (C major pentatonic) ────────────────────

const NOTE = {
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
  C6: 1046.50,
} as const;

// ─── Voice definitions ───────────────────────────────────────

type VoiceConfig = {
  name: string;
  cycleSec: number;
  calmPool: number[];
  tensePool: number[];
  oscType: OscillatorType;
  baseVol: number;
  attack: number;
  sustain: number;
  release: number;
};

const VOICES: VoiceConfig[] = [
  {
    name: 'padLow',
    cycleSec: 13,
    calmPool: [NOTE.C4, NOTE.G4],
    tensePool: [NOTE.C4, NOTE.E4],
    oscType: 'triangle',
    baseVol: 0.045,
    attack: 3, sustain: 6, release: 4,
  },
  {
    name: 'padMid',
    cycleSec: 17,
    calmPool: [NOTE.E4, NOTE.C5, NOTE.G5],
    tensePool: [NOTE.C4, NOTE.D5, NOTE.A4],
    oscType: 'triangle',
    baseVol: 0.035,
    attack: 2.5, sustain: 8, release: 5,
  },
  {
    name: 'padHigh',
    cycleSec: 11,
    calmPool: [NOTE.G4, NOTE.C5, NOTE.E5],
    tensePool: [NOTE.E4, NOTE.G4, NOTE.A4],
    oscType: 'sine',
    baseVol: 0.025,
    attack: 2, sustain: 5, release: 3,
  },
  {
    name: 'shimmer',
    cycleSec: 19,
    calmPool: [NOTE.C5, NOTE.G5, NOTE.C6],
    tensePool: [NOTE.E5, NOTE.A5],
    oscType: 'sine',
    baseVol: 0.015,
    attack: 3.5, sustain: 10, release: 4,
  },
  {
    name: 'arp',
    cycleSec: 3, // overridden by streak logic
    calmPool: [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5],
    tensePool: [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5],
    oscType: 'sine',
    baseVol: 0.02,
    attack: 0.3, sustain: 0.8, release: 0.6,
  },
];

// ─── Engine state ────────────────────────────────────────────

let ambientGain: GainNode | null = null;
let voiceTimers: ReturnType<typeof setTimeout>[] = [];
let running = false;
let paused = false;
let tension = 0;
let streak = 0;

const AMBIENT_BASE_VOL = 0.12;

// ─── Internal helpers ────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lerpPool(calm: number[], tense: number[], t: number): number {
  // At low tension, pick from calm pool. At high tension, pick from tense pool.
  // In between, probabilistically blend.
  if (Math.random() > t) return pick(calm);
  return pick(tense);
}

function playNote(freq: number, cfg: VoiceConfig, volMult: number): void {
  const ac = getCtx();
  const t = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = cfg.oscType;
  osc.frequency.value = freq;
  // Slight random detune for organic feel (±8 cents)
  osc.detune.value = (Math.random() - 0.5) * 16;

  const peakVol = cfg.baseVol * volMult;
  const totalDur = cfg.attack + cfg.sustain + cfg.release;

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peakVol, t + cfg.attack);
  gain.gain.setValueAtTime(peakVol, t + cfg.attack + cfg.sustain);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + totalDur);

  osc.connect(gain);
  gain.connect(ambientGain!);

  osc.start(t);
  osc.stop(t + totalDur + 0.05);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

function getVoiceVolMult(name: string, t: number): number {
  switch (name) {
    case 'padLow':  return 0.7 + t * 0.6;           // louder rumble under tension
    case 'padMid':  return 1.0;
    case 'padHigh': return 1.0 - t * 0.3;
    case 'shimmer': return 1.0 - t * 0.5;            // quieter shimmer under tension
    case 'arp':     return t > 0.85 ? 0 : 1.0;       // drops out at extreme tension
    default:        return 1.0;
  }
}

function getArpCycle(): number {
  if (streak <= 0)  return 0; // silent — timer won't fire
  if (streak <= 2)  return 3;
  if (streak <= 4)  return 2;
  if (streak <= 7)  return 1.5;
  return 1;
}

function scheduleVoice(idx: number): void {
  if (!running || paused) return;

  const cfg = VOICES[idx];
  const isArp = cfg.name === 'arp';

  // Arp stays silent when no streak
  if (isArp && streak <= 0) {
    // Re-check every 2s
    voiceTimers[idx] = setTimeout(() => scheduleVoice(idx), 2000);
    return;
  }

  const cycleSec = isArp ? getArpCycle() : cfg.cycleSec;
  if (cycleSec <= 0) {
    voiceTimers[idx] = setTimeout(() => scheduleVoice(idx), 2000);
    return;
  }

  const volMult = getVoiceVolMult(cfg.name, tension);
  if (volMult > 0.01) {
    const freq = lerpPool(cfg.calmPool, cfg.tensePool, tension);
    playNote(freq, cfg, volMult);

    // Arp at streak 8+: octave doubling
    if (isArp && streak >= 8) {
      playNote(freq * 2, cfg, volMult * 0.5);
    }
  }

  // Schedule next note after full cycle
  const jitter = 1 + (Math.random() - 0.5) * 0.15; // ±7.5% timing variation
  voiceTimers[idx] = setTimeout(
    () => scheduleVoice(idx),
    cycleSec * 1000 * jitter,
  );
}

// ─── Public API ──────────────────────────────────────────────

export function startAmbient(): void {
  if (running) return;

  const ac = getCtx();
  const master = getMaster();

  ambientGain = ac.createGain();
  ambientGain.gain.setValueAtTime(0.0001, ac.currentTime);
  ambientGain.gain.linearRampToValueAtTime(AMBIENT_BASE_VOL, ac.currentTime + 3);
  ambientGain.connect(master);

  running = true;
  paused = false;
  voiceTimers = [];

  // Stagger initial voice starts so they don't all hit at once
  for (let i = 0; i < VOICES.length; i++) {
    const delay = i * 1200 + Math.random() * 800;
    voiceTimers[i] = setTimeout(() => scheduleVoice(i), delay);
  }
}

export function stopAmbient(): void {
  if (!running) return;

  // Fade out over 1s, then disconnect
  if (ambientGain) {
    const ac = getCtx();
    const now = ac.currentTime;
    ambientGain.gain.cancelScheduledValues(now);
    ambientGain.gain.setValueAtTime(ambientGain.gain.value, now);
    ambientGain.gain.linearRampToValueAtTime(0.0001, now + 1);

    const ref = ambientGain;
    setTimeout(() => {
      try { ref.disconnect(); } catch { /* already disconnected */ }
    }, 1200);
  }

  for (const t of voiceTimers) clearTimeout(t);
  voiceTimers = [];
  running = false;
  paused = false;
  ambientGain = null;
}

export function pauseAmbient(): void {
  if (!running || paused) return;
  paused = true;

  for (const t of voiceTimers) clearTimeout(t);
  voiceTimers = [];

  if (ambientGain) {
    const ac = getCtx();
    const now = ac.currentTime;
    ambientGain.gain.cancelScheduledValues(now);
    ambientGain.gain.setValueAtTime(ambientGain.gain.value, now);
    ambientGain.gain.linearRampToValueAtTime(0.0001, now + 0.5);
  }
}

export function resumeAmbient(): void {
  if (!running || !paused) return;
  paused = false;

  if (ambientGain) {
    const ac = getCtx();
    const now = ac.currentTime;
    ambientGain.gain.cancelScheduledValues(now);
    ambientGain.gain.setValueAtTime(0.0001, now);
    ambientGain.gain.linearRampToValueAtTime(AMBIENT_BASE_VOL, now + 1);
  }

  // Restart voice schedulers with stagger
  voiceTimers = [];
  for (let i = 0; i < VOICES.length; i++) {
    const delay = i * 600 + Math.random() * 400;
    voiceTimers[i] = setTimeout(() => scheduleVoice(i), delay);
  }
}

export function setAmbientTension(t: number): void {
  tension = Math.max(0, Math.min(1, t));
}

export function setAmbientStreak(s: number): void {
  streak = Math.max(0, s);
}
