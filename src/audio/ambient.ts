/**
 * Generative ambient music engine.
 *
 * Brian Eno-style: overlapping tones with coprime cycle lengths
 * that create ever-changing but always-consonant patterns.
 * All voice timing adapts to player pace — faster play compresses
 * cycles, slower play stretches them. The arp voice locks directly
 * to placement tempo as a rhythmic heartbeat.
 *
 * Routing: voices → voiceGain → ambientGain ← LFO pulse
 *                                ambientGain → masterGain → destination
 */

import { getCtx, getMaster } from './synth';

// ─── Frequency table (C major pentatonic) ────────────────────

const NOTE = {
  C4: 261.63, E4: 329.63, G4: 392.00, A4: 440.00,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
  C6: 1046.50,
} as const;

// ─── Voice definitions ───────────────────────────────────────

type VoiceConfig = {
  name: string;
  cycleSec: number;
  paceInfluence: number;  // 0-1: how much cycle adapts to player pace
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
    paceInfluence: 0.25,
    calmPool: [NOTE.C4, NOTE.G4],
    tensePool: [NOTE.C4, NOTE.E4],
    oscType: 'triangle',
    baseVol: 0.035,
    attack: 3, sustain: 6, release: 4,
  },
  {
    name: 'padMid',
    cycleSec: 17,
    paceInfluence: 0.3,
    calmPool: [NOTE.E4, NOTE.C5, NOTE.G5],
    tensePool: [NOTE.C4, NOTE.A4, NOTE.D5],
    oscType: 'triangle',
    baseVol: 0.025,
    attack: 2.5, sustain: 8, release: 5,
  },
  {
    name: 'padHigh',
    cycleSec: 11,
    paceInfluence: 0.5,
    calmPool: [NOTE.G4, NOTE.C5, NOTE.E5],
    tensePool: [NOTE.E4, NOTE.G4, NOTE.A4],
    oscType: 'sine',
    baseVol: 0.018,
    attack: 2, sustain: 5, release: 3,
  },
  {
    name: 'shimmer',
    cycleSec: 19,
    paceInfluence: 0.15,
    calmPool: [NOTE.C5, NOTE.G5, NOTE.C6],
    tensePool: [NOTE.E5, NOTE.A5],
    oscType: 'sine',
    baseVol: 0.010,
    attack: 3.5, sustain: 10, release: 4,
  },
  {
    name: 'arp',
    cycleSec: 5,            // fallback; overridden by pace
    paceInfluence: 1.0,
    calmPool: [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5],
    tensePool: [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5],
    oscType: 'sine',
    baseVol: 0.015,
    attack: 0.15, sustain: 0.5, release: 0.4,  // short for rhythmic clarity
  },
];

// ─── Engine state ────────────────────────────────────────────

let ambientGain: GainNode | null = null;
let lfo: OscillatorNode | null = null;
let lfoGainNode: GainNode | null = null;
let voiceTimers: ReturnType<typeof setTimeout>[] = [];
let running = false;
let paused = false;
let tension = 0;
let streak = 0;
let paceMs = 5000;
let arpIndex = 0;

const AMBIENT_BASE_VOL = 0.06;
const LFO_DEPTH = 0.025;
const DEFAULT_LFO_FREQ = 0.1;
const REFERENCE_PACE_MS = 5000;  // "normal" tempo — cycles unchanged at this rate

// ─── Internal helpers ────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lerpPool(calm: number[], tense: number[], t: number): number {
  if (Math.random() > t) return pick(calm);
  return pick(tense);
}

/** Arp cycles sequentially through the note pool for melodic phrases. */
function getArpNote(cfg: VoiceConfig): number {
  const pool = tension > 0.5 ? cfg.tensePool : cfg.calmPool;
  const note = pool[arpIndex % pool.length];
  arpIndex++;
  return note;
}

function playNote(freq: number, cfg: VoiceConfig, volMult: number): void {
  const ac = getCtx();
  const t = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = cfg.oscType;
  osc.frequency.value = freq;
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
    case 'padLow':  return 0.7 + t * 0.6;
    case 'padMid':  return 1.0;
    case 'padHigh': return 1.0 - t * 0.3;
    case 'shimmer': return 1.0 - t * 0.5;
    case 'arp': {
      if (t > 0.85) return 0;             // drops out at extreme tension
      if (streak <= 0) return 0.3;         // quiet heartbeat
      if (streak <= 2) return 0.6;
      return 1.0;                          // full at streak 3+
    }
    default: return 1.0;
  }
}

/** Compute pace-adapted cycle for a voice. */
function getEffectiveCycleSec(cfg: VoiceConfig): number {
  if (cfg.name === 'arp') {
    // Arp locks directly to player placement tempo
    const base = Math.max(1.5, Math.min(8, paceMs / 1000));
    // Streak subdivides: consecutive clears speed up the arp
    if (streak >= 5) return base * 0.5;
    if (streak >= 3) return base * 0.7;
    return base;
  }

  // Pad/shimmer: partially scale cycle with pace via paceInfluence
  const clampedPace = Math.max(1500, Math.min(15000, paceMs));
  const paceFactor = REFERENCE_PACE_MS / clampedPace;
  // influence=0 → unchanged. influence=1 → fully scaled.
  return cfg.cycleSec / (1 + (paceFactor - 1) * cfg.paceInfluence);
}

function scheduleVoice(idx: number): void {
  if (!running || paused) return;

  const cfg = VOICES[idx];
  const isArp = cfg.name === 'arp';
  const cycleSec = getEffectiveCycleSec(cfg);

  if (cycleSec <= 0) {
    voiceTimers[idx] = setTimeout(() => scheduleVoice(idx), 2000);
    return;
  }

  const volMult = getVoiceVolMult(cfg.name, tension);
  if (volMult > 0.01) {
    const freq = isArp ? getArpNote(cfg) : lerpPool(cfg.calmPool, cfg.tensePool, tension);
    playNote(freq, cfg, volMult);

    // Arp at streak 8+: octave doubling for brightness
    if (isArp && streak >= 8) {
      playNote(freq * 2, cfg, volMult * 0.5);
    }
  }

  const jitter = 1 + (Math.random() - 0.5) * 0.15;
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

  // Pulse LFO — sine oscillator modulates ambientGain at player's pace
  lfo = ac.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = DEFAULT_LFO_FREQ;

  lfoGainNode = ac.createGain();
  lfoGainNode.gain.setValueAtTime(0, ac.currentTime);
  lfoGainNode.gain.linearRampToValueAtTime(LFO_DEPTH, ac.currentTime + 3);

  lfo.connect(lfoGainNode);
  lfoGainNode.connect(ambientGain.gain);
  lfo.start();

  running = true;
  paused = false;
  arpIndex = 0;
  voiceTimers = [];

  for (let i = 0; i < VOICES.length; i++) {
    const delay = i * 1200 + Math.random() * 800;
    voiceTimers[i] = setTimeout(() => scheduleVoice(i), delay);
  }
}

export function stopAmbient(): void {
  if (!running) return;

  if (ambientGain) {
    const ac = getCtx();
    const now = ac.currentTime;
    ambientGain.gain.cancelScheduledValues(now);
    ambientGain.gain.setValueAtTime(ambientGain.gain.value, now);
    ambientGain.gain.linearRampToValueAtTime(0.0001, now + 1);

    if (lfoGainNode) {
      lfoGainNode.gain.cancelScheduledValues(now);
      lfoGainNode.gain.setValueAtTime(0, now);
    }

    const refGain = ambientGain;
    const refLfo = lfo;
    const refLfoGain = lfoGainNode;
    setTimeout(() => {
      try { refLfo?.stop(); } catch { /* */ }
      try { refLfo?.disconnect(); } catch { /* */ }
      try { refLfoGain?.disconnect(); } catch { /* */ }
      try { refGain.disconnect(); } catch { /* */ }
    }, 1200);
  }

  for (const t of voiceTimers) clearTimeout(t);
  voiceTimers = [];
  running = false;
  paused = false;
  arpIndex = 0;
  ambientGain = null;
  lfo = null;
  lfoGainNode = null;
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
  if (lfoGainNode) {
    const ac = getCtx();
    const now = ac.currentTime;
    lfoGainNode.gain.cancelScheduledValues(now);
    lfoGainNode.gain.setValueAtTime(lfoGainNode.gain.value, now);
    lfoGainNode.gain.linearRampToValueAtTime(0, now + 0.5);
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
  if (lfoGainNode) {
    const ac = getCtx();
    const now = ac.currentTime;
    lfoGainNode.gain.cancelScheduledValues(now);
    lfoGainNode.gain.setValueAtTime(0, now);
    lfoGainNode.gain.linearRampToValueAtTime(LFO_DEPTH, now + 1);
  }

  voiceTimers = [];
  for (let i = 0; i < VOICES.length; i++) {
    const delay = i * 600 + Math.random() * 400;
    voiceTimers[i] = setTimeout(() => scheduleVoice(i), delay);
  }
}

/** Update pace from average ms between piece placements. */
export function setAmbientPace(intervalMs: number): void {
  paceMs = Math.max(1500, Math.min(15000, intervalMs));

  if (!lfo) return;
  // LFO pulse also tracks pace
  const freq = 1000 / paceMs;
  const clamped = Math.max(0.06, Math.min(0.5, freq));
  const ac = getCtx();
  const now = ac.currentTime;
  lfo.frequency.cancelScheduledValues(now);
  lfo.frequency.setValueAtTime(lfo.frequency.value, now);
  lfo.frequency.linearRampToValueAtTime(clamped, now + 0.5);
}

export function setAmbientTension(t: number): void {
  tension = Math.max(0, Math.min(1, t));
}

export function setAmbientStreak(s: number): void {
  streak = Math.max(0, s);
}
