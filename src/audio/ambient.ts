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
 * Signal chain:
 *   voices → StereoPannerNode → ambientGain ← LFO pulse
 *   ambientGain → WaveShaperNode (sat) → dry GainNode → masterGain
 *                                      → ConvolverNode → wet GainNode → masterGain
 *   masterGain → DynamicsCompressor → destination  (compressor lives in synth.ts)
 *
 * Lo-fi piano voice uses Karplus-Strong string synthesis (noise burst → delay
 * feedback loop) instead of the standard oscillator path, plus tape wow/flutter
 * LFOs for cassette-recorder pitch drift.
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
  pan?: number;               // stereo position: -1 (left) … 0 (center) … +1 (right)
  tapeWobble?: boolean;       // tape wow + flutter LFOs (lo-fi piano only)
  karplus?: boolean;          // Karplus-Strong synthesis instead of oscillator
};

// ─── Theme: Ambient (Brian Eno-style drifting pads) ───────────

const VOICES_AMBIENT: VoiceConfig[] = [
  {
    name: 'padLow',
    cycleSec: 13, paceInfluence: 0.25,
    calmPool: [NOTE.C4, NOTE.G4], tensePool: [NOTE.C4, NOTE.E4],
    oscType: 'triangle', baseVol: 0.035,
    attack: 3, sustain: 6, release: 4,
    pan: 0.0,
  },
  {
    name: 'padMid',
    cycleSec: 17, paceInfluence: 0.3,
    calmPool: [NOTE.E4, NOTE.C5, NOTE.G5], tensePool: [NOTE.C4, NOTE.A4, NOTE.D5],
    oscType: 'triangle', baseVol: 0.025,
    attack: 2.5, sustain: 8, release: 5,
    pan: -0.25,
  },
  {
    name: 'padHigh',
    cycleSec: 11, paceInfluence: 0.5,
    calmPool: [NOTE.G4, NOTE.C5, NOTE.E5], tensePool: [NOTE.E4, NOTE.G4, NOTE.A4],
    oscType: 'sine', baseVol: 0.018,
    attack: 2, sustain: 5, release: 3,
    pan: 0.25,
  },
  {
    name: 'shimmer',
    cycleSec: 19, paceInfluence: 0.15,
    calmPool: [NOTE.C5, NOTE.G5, NOTE.C6], tensePool: [NOTE.E5, NOTE.A5],
    oscType: 'sine', baseVol: 0.010,
    attack: 3.5, sustain: 10, release: 4,
    pan: 0.0,
  },
  {
    name: 'arp',
    cycleSec: 5, paceInfluence: 1.0,
    calmPool: [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5],
    tensePool: [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5],
    oscType: 'sine', baseVol: 0.015,
    attack: 0.15, sustain: 0.5, release: 0.4,
    paceMult: 2.5, streakSubdivide: true,
    pan: 0.0,
  },
];

// ─── Theme: Pulse (upbeat driving electronic) ─────────────────

const VOICES_PULSE: VoiceConfig[] = [
  {
    name: 'bass',
    cycleSec: 2.0, paceInfluence: 0.15,
    calmPool: [NOTE.C4, NOTE.G4], tensePool: [NOTE.G4, NOTE.A4],
    oscType: 'triangle', baseVol: 0.048,
    attack: 0.005, sustain: 0.15, release: 0.10,
    pan: 0.0,
  },
  {
    name: 'stab',
    cycleSec: 4.0, paceInfluence: 0.20,
    calmPool: [NOTE.E5, NOTE.G5, NOTE.A5], tensePool: [NOTE.G5, NOTE.A5, NOTE.C6],
    oscType: 'triangle', baseVol: 0.032,
    attack: 0.008, sustain: 0.22, release: 0.15,
    pan: -0.3,
  },
  {
    name: 'lead',
    cycleSec: 5.5, paceInfluence: 0.40,
    calmPool: [NOTE.C5, NOTE.G5, NOTE.C6], tensePool: [NOTE.E5, NOTE.A5, NOTE.C6],
    oscType: 'sine', baseVol: 0.022,
    attack: 0.025, sustain: 0.45, release: 0.35,
    pan: 0.15,
  },
  {
    name: 'accent',
    cycleSec: 4.2, paceInfluence: 0.25,
    calmPool: [NOTE.G5, NOTE.A5, NOTE.C6], tensePool: [NOTE.A5, NOTE.C6],
    oscType: 'sine', baseVol: 0.014,
    attack: 0.012, sustain: 0.28, release: 0.32,
    pan: 0.4,
  },
  {
    name: 'arp',
    cycleSec: 3, paceInfluence: 1.0,
    calmPool: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6],
    tensePool: [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5],
    oscType: 'triangle', baseVol: 0.022,
    attack: 0.010, sustain: 0.18, release: 0.12,
    paceMult: 4.0, streakSubdivide: false,
    pan: 0.0,
  },
];

// ─── Theme: Lo-fi (fast piano + warm chords) ──────────────────
//
// Piano voice uses Karplus-Strong synthesis for a plucked-string feel.
// Tape wobble (wow + flutter) adds subliminal cassette-recorder pitch drift.
// tensePool excludes A4 (2.27ms delay — borderline for Karplus on some browsers).

const VOICES_LOFI: VoiceConfig[] = [
  {
    name: 'lowChord',
    cycleSec: 3.5, paceInfluence: 0.25,
    calmPool: [NOTE.C4, NOTE.E4, NOTE.G4], tensePool: [NOTE.C4, NOTE.G4],
    oscType: 'triangle', baseVol: 0.030,
    attack: 0.3, sustain: 1.0, release: 1.2,
    pan: 0.0,
  },
  {
    name: 'piano',
    cycleSec: 2.5, paceInfluence: 0.40,
    calmPool: [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5], tensePool: [NOTE.C5, NOTE.E5],
    oscType: 'triangle', baseVol: 0.030,
    attack: 0.012, sustain: 0.45, release: 0.55,
    pan: -0.1, tapeWobble: true, karplus: true,
  },
  {
    name: 'hiNote',
    cycleSec: 4.5, paceInfluence: 0.50,
    calmPool: [NOTE.G5, NOTE.A5, NOTE.C6], tensePool: [NOTE.E5, NOTE.G5, NOTE.A5],
    oscType: 'sine', baseVol: 0.016,
    attack: 0.08, sustain: 0.6, release: 0.7,
    pan: 0.3,
  },
  {
    name: 'shimmer',
    cycleSec: 6, paceInfluence: 0.15,
    calmPool: [NOTE.C5, NOTE.G5, NOTE.C6], tensePool: [NOTE.E5, NOTE.A5],
    oscType: 'sine', baseVol: 0.009,
    attack: 0.6, sustain: 1.5, release: 1.8,
    pan: 0.0,
  },
  {
    name: 'arp',
    cycleSec: 5, paceInfluence: 1.0,
    calmPool: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.A5],
    tensePool: [NOTE.C5, NOTE.D5, NOTE.E5],
    oscType: 'sine', baseVol: 0.014,
    attack: 0.04, sustain: 0.28, release: 0.25,
    paceMult: 3.5, streakSubdivide: true,
    pan: 0.0,
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

// Effect chain (rebuilt per theme: ambientGain → sat → reverb → master)
let satNode: WaveShaperNode | null = null;
let convolver: ConvolverNode | null = null;
let reverbDryGain: GainNode | null = null;
let reverbWetGain: GainNode | null = null;

const AMBIENT_BASE_VOL = 0.06;
const LFO_DEPTH = 0.025;
const DEFAULT_LFO_FREQ = 0.25;
const REFERENCE_PACE_MS = 5000;
const PACE_MULT = 2.5;

// ─── Effect chain: saturation + reverb ────────────────────────

/**
 * Tanh soft-saturation lookup curve.
 * Drive 1.5 = barely perceptible warmth.
 * Drive 3.0 = clear cassette-tape character.
 * Uses tanh normalised so output stays in [-1, 1].
 */
function buildSatCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 256;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const denom = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh(drive * x) / denom;
  }
  return curve;
}

/**
 * Algorithmic impulse response for ConvolverNode reverb.
 * Exponential noise decay — no audio files required.
 * durationSec controls room size; decayRate controls damping (higher = deader).
 */
function buildIR(ac: AudioContext, durationSec: number, decayRate: number): AudioBuffer {
  const length = Math.ceil(ac.sampleRate * durationSec);
  const ir = ac.createBuffer(2, length, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decayRate);
    }
  }
  return ir;
}

type ReverbCfg = { duration: number; decay: number; wet: number; satDrive: number };

function getThemeReverbCfg(): ReverbCfg {
  switch (currentTheme) {
    // Tight room reverb — keeps the punch in the rhythm
    case 'pulse': return { duration: 0.3, decay: 8.0, wet: 0.12, satDrive: 1.5 };
    // Small bedroom reverb — cozy, intimate; heavy saturation for cassette warmth
    case 'lofi':  return { duration: 0.6, decay: 6.0, wet: 0.20, satDrive: 3.0 };
    // Large hall reverb — Eno-style spatial diffusion
    default:      return { duration: 2.5, decay: 3.0, wet: 0.38, satDrive: 2.0 };
  }
}

/**
 * Wire ambientGain → saturation → [dry + reverb wet] → master.
 * Called once at startAmbient() and again on each theme switch.
 */
function buildEffectChain(ac: AudioContext, master: GainNode): void {
  const cfg = getThemeReverbCfg();

  satNode = ac.createWaveShaper();
  satNode.curve = buildSatCurve(cfg.satDrive);
  satNode.oversample = '2x';

  convolver = ac.createConvolver();
  convolver.buffer = buildIR(ac, cfg.duration, cfg.decay);

  reverbDryGain = ac.createGain();
  reverbDryGain.gain.value = 1 - cfg.wet;

  reverbWetGain = ac.createGain();
  reverbWetGain.gain.value = cfg.wet;

  ambientGain!.connect(satNode);
  satNode.connect(reverbDryGain);
  satNode.connect(convolver);
  convolver.connect(reverbWetGain);
  reverbDryGain.connect(master);
  reverbWetGain.connect(master);
}

/** Disconnect and null all effect chain nodes. */
function tearDownEffectChain(): void {
  if (satNode && ambientGain) {
    try { ambientGain.disconnect(satNode); } catch { /* */ }
  }
  try { satNode?.disconnect(); }       catch { /* */ }
  try { convolver?.disconnect(); }     catch { /* */ }
  try { reverbDryGain?.disconnect(); } catch { /* */ }
  try { reverbWetGain?.disconnect(); } catch { /* */ }
  satNode = null;
  convolver = null;
  reverbDryGain = null;
  reverbWetGain = null;
}

// ─── Karplus-Strong string synthesis ──────────────────────────

/**
 * Plucked string simulation for lo-fi piano voice.
 * Algorithm: noise burst → DelayNode (tuned to 1/freq) → lowpass filter →
 *            feedback gain (< 1.0) → back into delay → tap output.
 *
 * The lowpass in the feedback loop models energy loss per string reflection.
 * feedback.gain controls sustain length (0.982 ≈ natural piano damping).
 *
 * Minimum safe frequency: ~350 Hz (3 ms delay — DelayNode floor on most browsers).
 */
function karplusPluck(freq: number, vol: number, pan: number): void {
  if (!ambientGain) return;
  const ac = getCtx();
  const t = ac.currentTime;

  const delayTime = Math.max(0.003, 1 / freq);
  const duration = 2.0;
  const burstDur = Math.max(delayTime * 3, 0.02);

  // White noise excitation burst
  const bufSize = Math.ceil(ac.sampleRate * burstDur);
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const burst = ac.createBufferSource();
  burst.buffer = buf;

  // Delay tuned to fundamental period
  const delay = ac.createDelay(0.1);
  delay.delayTime.value = delayTime;

  // Lowpass in feedback loop — models string damping (loses highs each bounce)
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.min(freq * 5, 4000);
  filter.Q.value = 0.5;

  // Feedback gain: 0.982 → each loop loses ~2% energy → decays over ~100 loops
  const feedback = ac.createGain();
  feedback.gain.value = 0.982;

  const outGain = ac.createGain();
  outGain.gain.setValueAtTime(vol, t);
  outGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  const panner = ac.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan + (Math.random() - 0.5) * 0.08));

  // String loop: burst → delay → filter → feedback → delay (loop)
  //                                filter → outGain → panner → ambientGain (output tap)
  burst.connect(delay);
  delay.connect(filter);
  filter.connect(feedback);
  feedback.connect(delay);
  filter.connect(outGain);
  outGain.connect(panner);
  panner.connect(ambientGain!);

  burst.start(t);
  burst.stop(t + burstDur + 0.01);

  setTimeout(() => {
    try { burst.disconnect(); delay.disconnect(); filter.disconnect(); } catch { /* */ }
    try { feedback.disconnect(); outGain.disconnect(); panner.disconnect(); } catch { /* */ }
  }, (duration + 0.3) * 1000);
}

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

/**
 * Play one note via oscillator → gain → StereoPanner → ambientGain.
 * Optionally applies tape wow/flutter LFOs to the oscillator's detune
 * for cassette-recorder pitch drift (lo-fi piano only).
 */
function playNote(freq: number, cfg: VoiceConfig, volMult: number): void {
  const ac = getCtx();
  const t = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const panner = ac.createStereoPanner();

  osc.type = cfg.oscType;
  osc.frequency.value = freq;
  osc.detune.value = (Math.random() - 0.5) * 16;

  const peakVol = cfg.baseVol * volMult;
  const totalDur = cfg.attack + cfg.sustain + cfg.release;

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peakVol, t + cfg.attack);
  gain.gain.setValueAtTime(peakVol, t + cfg.attack + cfg.sustain);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + totalDur);

  // Stereo placement: per-voice base pan ± slight per-note spatial jitter
  const basePan = cfg.pan ?? 0;
  panner.pan.value = Math.max(-1, Math.min(1, basePan + (Math.random() - 0.5) * 0.1));

  // Tape wow + flutter for lo-fi cassette character
  // Wow: slow (≈0.5 Hz) ±4 cents pitch drift
  // Flutter: fast (≈8 Hz) ±1.5 cents micro-variation
  let wowLfo: OscillatorNode | null = null;
  let wowGain: GainNode | null = null;
  let flutterLfo: OscillatorNode | null = null;
  let flutterGain: GainNode | null = null;

  if (cfg.tapeWobble) {
    wowLfo = ac.createOscillator();
    wowGain = ac.createGain();
    wowLfo.type = 'sine';
    wowLfo.frequency.value = 0.45 + Math.random() * 0.25;
    wowGain.gain.value = 4; // ±4 cents
    wowLfo.connect(wowGain);
    wowGain.connect(osc.detune);

    flutterLfo = ac.createOscillator();
    flutterGain = ac.createGain();
    flutterLfo.type = 'sine';
    flutterLfo.frequency.value = 7 + Math.random() * 2.5;
    flutterGain.gain.value = 1.5; // ±1.5 cents
    flutterLfo.connect(flutterGain);
    flutterGain.connect(osc.detune);

    wowLfo.start(t);
    flutterLfo.start(t);
  }

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(ambientGain!);

  osc.start(t);
  osc.stop(t + totalDur + 0.05);

  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
    panner.disconnect();
    if (wowLfo)    { try { wowLfo.stop(); }    catch { /* */ } wowLfo.disconnect(); }
    if (wowGain)   { wowGain.disconnect(); }
    if (flutterLfo) { try { flutterLfo.stop(); } catch { /* */ } flutterLfo.disconnect(); }
    if (flutterGain) { flutterGain.disconnect(); }
  };
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

    if (cfg.karplus) {
      // Karplus-Strong string pluck (lo-fi piano)
      karplusPluck(freq, cfg.baseVol * volMult, cfg.pan ?? 0);
    } else {
      playNote(freq, cfg, volMult);
      // Octave doubling at high streak for brightness (arp only)
      if (isArp && streak >= 8) {
        playNote(freq * 2, cfg, volMult * 0.5);
      }
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

  lfo = ac.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = DEFAULT_LFO_FREQ;

  lfoGainNode = ac.createGain();
  lfoGainNode.gain.setValueAtTime(0, ac.currentTime);
  lfoGainNode.gain.linearRampToValueAtTime(LFO_DEPTH, ac.currentTime + 3);

  lfo.connect(lfoGainNode);
  lfoGainNode.connect(ambientGain.gain);
  lfo.start();

  // Effect chain: ambientGain → sat → reverb (dry+wet) → master
  buildEffectChain(ac, master);

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
    const refSat = satNode;
    const refConv = convolver;
    const refDry = reverbDryGain;
    const refWet = reverbWetGain;

    setTimeout(() => {
      try { refLfo?.stop(); }           catch { /* */ }
      try { refLfo?.disconnect(); }     catch { /* */ }
      try { refLfoGain?.disconnect(); } catch { /* */ }
      try { refGain.disconnect(); }     catch { /* */ }
      try { refSat?.disconnect(); }     catch { /* */ }
      try { refConv?.disconnect(); }    catch { /* */ }
      try { refDry?.disconnect(); }     catch { /* */ }
      try { refWet?.disconnect(); }     catch { /* */ }
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
  satNode = null;
  convolver = null;
  reverbDryGain = null;
  reverbWetGain = null;
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
 * Switch music style on the fly. Old notes fade naturally (no silence gap).
 * Rebuilds the effect chain with the new theme's reverb + saturation settings.
 */
export function setMusicTheme(theme: MusicTheme): void {
  if (theme === currentTheme) return;
  currentTheme = theme;
  arpIndex = 0;

  if (!running || paused) return;

  for (const t of voiceTimers) clearTimeout(t);
  voiceTimers = [];

  // Rebuild effect chain with new theme reverb / saturation settings
  if (ambientGain) {
    tearDownEffectChain();
    buildEffectChain(getCtx(), getMaster());
  }

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

/**
 * Briefly duck the music volume when a prominent SFX fires.
 * Prevents SFX from muddying against the ambient mix.
 *
 * @param amount     - target level as fraction of AMBIENT_BASE_VOL (0.5 = 50% duck)
 * @param durationSec - total duration including recovery ramp
 */
export function duckMusic(amount: number = 0.5, durationSec: number = 0.3): void {
  if (!ambientGain || !running || paused) return;
  const ac = getCtx();
  const now = ac.currentTime;
  // LFO_DEPTH is 0.025; keep duck target above LFO swing floor to avoid inversion
  const target = Math.max(AMBIENT_BASE_VOL * Math.max(amount, 0.45), LFO_DEPTH + 0.005);
  ambientGain.gain.cancelScheduledValues(now);
  ambientGain.gain.setValueAtTime(ambientGain.gain.value, now);
  ambientGain.gain.linearRampToValueAtTime(target, now + 0.025);
  ambientGain.gain.linearRampToValueAtTime(AMBIENT_BASE_VOL, now + durationSec);
}
