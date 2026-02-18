/**
 * Generative ambient music engine.
 *
 * Three selectable styles:
 *   'ambient' — Brian Eno-style slow drifting pads (default)
 *   'pulse'   — Upbeat driving electronic with rhythmic stabs and fast arp
 *   'lofi'    — Mellow piano-like melody with warm sustained chords
 *
 * All voice timing adapts to player pace. The arp voice is pace-locked
 * as a rhythmic heartbeat. Theme switching is seamless (no silence gap).
 *
 * Routing: voices → playNote → ambientGain ← LFO pulse
 *                               ambientGain → masterGain → destination
 */

import { getCtx, getMaster } from './synth';

export type MusicTheme = 'ambient' | 'pulse' | 'lofi';

// ─── Frequency table (C major pentatonic + additions) ─────────

const NOTE = {
  C4: 261.63, E4: 329.63, G4: 392.00, A4: 440.00,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
  C6: 1046.50,
} as const;

// ─── Voice config ─────────────────────────────────────────────

type VoiceConfig = {
  name: string;
  cycleSec: number;
  paceInfluence: number;    // 0-1: how much cycle adapts to player pace
  calmPool: number[];
  tensePool: number[];
  oscType: OscillatorType;
  baseVol: number;
  attack: number;
  sustain: number;
  release: number;
  paceMult?: number;          // arp pace multiplier (default: PACE_MULT)
  streakSubdivide?: boolean;  // arp subdivides at high streak (default: true)
};

// ─── Theme: Ambient (Brian Eno-style drifting pads) ───────────

const VOICES_AMBIENT: VoiceConfig[] = [
  {
    name: 'padLow',
    cycleSec: 13, paceInfluence: 0.25,
    calmPool: [NOTE.C4, NOTE.G4], tensePool: [NOTE.C4, NOTE.E4],
    oscType: 'triangle', baseVol: 0.035,
    attack: 3, sustain: 6, release: 4,
  },
  {
    name: 'padMid',
    cycleSec: 17, paceInfluence: 0.3,
    calmPool: [NOTE.E4, NOTE.C5, NOTE.G5], tensePool: [NOTE.C4, NOTE.A4, NOTE.D5],
    oscType: 'triangle', baseVol: 0.025,
    attack: 2.5, sustain: 8, release: 5,
  },
  {
    name: 'padHigh',
    cycleSec: 11, paceInfluence: 0.5,
    calmPool: [NOTE.G4, NOTE.C5, NOTE.E5], tensePool: [NOTE.E4, NOTE.G4, NOTE.A4],
    oscType: 'sine', baseVol: 0.018,
    attack: 2, sustain: 5, release: 3,
  },
  {
    name: 'shimmer',
    cycleSec: 19, paceInfluence: 0.15,
    calmPool: [NOTE.C5, NOTE.G5, NOTE.C6], tensePool: [NOTE.E5, NOTE.A5],
    oscType: 'sine', baseVol: 0.010,
    attack: 3.5, sustain: 10, release: 4,
  },
  {
    name: 'arp',
    cycleSec: 5, paceInfluence: 1.0,
    calmPool: [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5],
    tensePool: [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5],
    oscType: 'sine', baseVol: 0.015,
    attack: 0.15, sustain: 0.5, release: 0.4,
    paceMult: 2.5, streakSubdivide: true,
  },
];

// ─── Theme: Pulse (upbeat driving electronic) ─────────────────
//
// Short staccato notes, fast cycles, punchy bass hits and chord stabs.
// Arp runs at 4× player pace with snappy attack for a driving feel.

const VOICES_PULSE: VoiceConfig[] = [
  {
    // Punchy bass root — thumps on the beat
    name: 'bass',
    cycleSec: 2.0, paceInfluence: 0.15,
    calmPool: [NOTE.C4, NOTE.G4], tensePool: [NOTE.G4, NOTE.A4],
    oscType: 'triangle', baseVol: 0.048,
    attack: 0.005, sustain: 0.15, release: 0.10,
  },
  {
    // Bright chord stab — upbeat synth hit every few seconds
    name: 'stab',
    cycleSec: 4.0, paceInfluence: 0.20,
    calmPool: [NOTE.E5, NOTE.G5, NOTE.A5], tensePool: [NOTE.G5, NOTE.A5, NOTE.C6],
    oscType: 'triangle', baseVol: 0.032,
    attack: 0.008, sustain: 0.22, release: 0.15,
  },
  {
    // Synth lead — melodic hook over the rhythm
    name: 'lead',
    cycleSec: 5.5, paceInfluence: 0.40,
    calmPool: [NOTE.C5, NOTE.G5, NOTE.C6], tensePool: [NOTE.E5, NOTE.A5, NOTE.C6],
    oscType: 'sine', baseVol: 0.022,
    attack: 0.025, sustain: 0.45, release: 0.35,
  },
  {
    // Bright accent — sparse high shimmer
    name: 'accent',
    cycleSec: 4.2, paceInfluence: 0.25,
    calmPool: [NOTE.G5, NOTE.A5, NOTE.C6], tensePool: [NOTE.A5, NOTE.C6],
    oscType: 'sine', baseVol: 0.014,
    attack: 0.012, sustain: 0.28, release: 0.32,
  },
  {
    // Fast driving arp — the rhythmic heartbeat at 4× pace
    name: 'arp',
    cycleSec: 3, paceInfluence: 1.0,
    calmPool: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6],
    tensePool: [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5],
    oscType: 'triangle', baseVol: 0.022,
    attack: 0.010, sustain: 0.18, release: 0.12,
    paceMult: 4.0, streakSubdivide: false,  // already fast, no further subdivision
  },
];

// ─── Theme: Lo-fi (mellow piano + warm chords) ────────────────
//
// Piano-like short attacks with warm sustained tails. Laid-back arp at 2×.
// Note selection includes D5 for a subtle jazzy flavour.

const VOICES_LOFI: VoiceConfig[] = [
  {
    // Warm low chord — slow pad foundation
    name: 'lowChord',
    cycleSec: 8, paceInfluence: 0.20,
    calmPool: [NOTE.C4, NOTE.E4, NOTE.G4], tensePool: [NOTE.C4, NOTE.G4],
    oscType: 'triangle', baseVol: 0.030,
    attack: 0.5, sustain: 3, release: 2.5,
  },
  {
    // Piano pluck — short attack, warm tail
    name: 'piano',
    cycleSec: 5.5, paceInfluence: 0.35,
    calmPool: [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5], tensePool: [NOTE.A4, NOTE.C5, NOTE.E5],
    oscType: 'triangle', baseVol: 0.028,
    attack: 0.015, sustain: 1.2, release: 1.5,
  },
  {
    // Airy melody note — occasional high bright tone
    name: 'hiNote',
    cycleSec: 10, paceInfluence: 0.45,
    calmPool: [NOTE.G5, NOTE.A5, NOTE.C6], tensePool: [NOTE.E5, NOTE.G5, NOTE.A5],
    oscType: 'sine', baseVol: 0.015,
    attack: 0.20, sustain: 2, release: 2,
  },
  {
    // Soft shimmer — sparse background texture
    name: 'shimmer',
    cycleSec: 14, paceInfluence: 0.10,
    calmPool: [NOTE.C5, NOTE.G5, NOTE.C6], tensePool: [NOTE.E5, NOTE.A5],
    oscType: 'sine', baseVol: 0.008,
    attack: 1.5, sustain: 5, release: 4,
  },
  {
    // Gentle arp — relaxed, laid-back at 2× pace
    name: 'arp',
    cycleSec: 5, paceInfluence: 1.0,
    calmPool: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.A5],
    tensePool: [NOTE.C5, NOTE.D5, NOTE.E5],
    oscType: 'sine', baseVol: 0.012,
    attack: 0.08, sustain: 0.6, release: 0.5,
    paceMult: 2.0, streakSubdivide: true,
  },
];

// ─── Engine state ─────────────────────────────────────────────

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
let currentTheme: MusicTheme = 'ambient';

const AMBIENT_BASE_VOL = 0.06;
const LFO_DEPTH = 0.025;
const DEFAULT_LFO_FREQ = 0.25;
const REFERENCE_PACE_MS = 5000;
const PACE_MULT = 2.5;

// ─── Internal helpers ─────────────────────────────────────────

function getVoices(): VoiceConfig[] {
  switch (currentTheme) {
    case 'pulse': return VOICES_PULSE;
    case 'lofi':  return VOICES_LOFI;
    default:      return VOICES_AMBIENT;
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lerpPool(calm: number[], tense: number[], t: number): number {
  if (Math.random() > t) return pick(calm);
  return pick(tense);
}

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
    // Ambient voices
    case 'padLow':   return 0.7 + t * 0.6;
    case 'padMid':   return 1.0;
    case 'padHigh':  return 1.0 - t * 0.3;
    // Pulse voices
    case 'bass':     return 0.7 + t * 0.5;     // heavier under tension
    case 'stab':     return 1.0 - t * 0.15;
    case 'lead':     return 0.8 + t * 0.35;    // more prominent under tension
    case 'accent':   return 1.0 - t * 0.45;    // fades under tension
    // Lofi voices
    case 'lowChord': return 0.6 + t * 0.5;
    case 'piano':    return 1.0 - t * 0.1;
    case 'hiNote':   return 0.9 - t * 0.3;
    // Shimmer (shared by Ambient and Lofi)
    case 'shimmer':  return 1.0 - t * 0.5;
    // Arp (all themes — volume driven by streak)
    case 'arp': {
      if (t > 0.85) return 0;
      if (streak <= 0) return 0.3;
      if (streak <= 2) return 0.6;
      return 1.0;
    }
    default: return 1.0;
  }
}

function getEffectiveCycleSec(cfg: VoiceConfig): number {
  if (cfg.name === 'arp') {
    const mult = cfg.paceMult ?? PACE_MULT;
    const base = Math.max(0.6, Math.min(4, paceMs / 1000 / mult));
    if (cfg.streakSubdivide !== false) {
      if (streak >= 5) return base * 0.5;
      if (streak >= 3) return base * 0.7;
    }
    return base;
  }

  const clampedPace = Math.max(1500, Math.min(15000, paceMs));
  const paceFactor = (REFERENCE_PACE_MS / clampedPace) * PACE_MULT;
  return cfg.cycleSec / (1 + (paceFactor - 1) * cfg.paceInfluence);
}

function scheduleVoice(idx: number): void {
  if (!running || paused) return;
  const voices = getVoices();
  if (idx >= voices.length) return;

  const cfg = voices[idx];
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

    // Octave doubling at high streak for brightness (arp only)
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

function startVoiceTimers(stagger: number): void {
  const voices = getVoices();
  for (let i = 0; i < voices.length; i++) {
    const delay = i * stagger + Math.random() * (stagger * 0.5);
    voiceTimers[i] = setTimeout(() => scheduleVoice(i), delay);
  }
}

// ─── Public API ───────────────────────────────────────────────

export function startAmbient(): void {
  if (running) return;

  const ac = getCtx();
  const master = getMaster();

  ambientGain = ac.createGain();
  ambientGain.gain.setValueAtTime(0.0001, ac.currentTime);
  ambientGain.gain.linearRampToValueAtTime(AMBIENT_BASE_VOL, ac.currentTime + 3);
  ambientGain.connect(master);

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
  startVoiceTimers(1200);
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
  startVoiceTimers(600);
}

/**
 * Switch music style on the fly. No silence gap — old notes fade naturally,
 * new voices start immediately with a short stagger.
 */
export function setMusicTheme(theme: MusicTheme): void {
  if (theme === currentTheme) return;
  currentTheme = theme;
  arpIndex = 0;

  if (!running || paused) return;

  // Seamless switch: clear old timers, start new voices immediately
  for (const t of voiceTimers) clearTimeout(t);
  voiceTimers = [];
  startVoiceTimers(300);
}

/** Update pace from average ms between piece placements. */
export function setAmbientPace(intervalMs: number): void {
  paceMs = Math.max(1500, Math.min(15000, intervalMs));

  if (!lfo) return;
  const freq = (1000 / paceMs) * PACE_MULT;
  const clamped = Math.max(0.1, Math.min(1.2, freq));
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
