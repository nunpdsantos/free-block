/**
 * Generative ambient music engine.
 *
 * Three selectable styles:
 *   'ambient' — Brian Eno-style slow drifting pads
 *   'pulse'   — Upbeat driving electronic (beat-clock quantised)
 *   'lofi'    — Mellow piano-like melody with swing arp
 *
 * Tier 1 features (per-note signal chain):
 *   voices → StereoPanner → [padFilter?] → ambientGain ← LFO
 *   ambientGain → WaveShaperNode (sat) → dry GainNode      → masterGain
 *                                      → ConvolverNode wet → masterGain
 *   [ambient arp] → pingPongDelay → ambientGain
 *   masterGain → DynamicsCompressor → destination  (compressor in synth.ts)
 *
 * Tier 2 features:
 *   - Chord progression engine: I→VI→IV→II (calm) / I→VIm→IVsus→V (tense), 20s each
 *   - Voice leading: each voice prefers the note closest to its previous
 *   - Ping-pong delay on ambient arp, delay time tracks paceMs
 *   - BiquadFilter lowpass on ambient pad voices, cutoff driven by tension
 *   - Beat-clock scheduler for pulse theme (AudioContext.currentTime grid, no drift)
 *   - Swing on lo-fi arp (8% alternating long/short intervals)
 *   - PeriodicWave electric-piano timbre for lo-fi lowChord + hiNote voices
 *   - Exports getCurrentChordRoot() + isAmbientRunning() for SFX chord alignment
 */

import { getCtx, getMaster } from './synth';
import { detectRhythmPeriod } from './rhythmDetector';

export type MusicTheme = 'ambient' | 'pulse' | 'lofi' | 'drift';

// ─── Frequency table ──────────────────────────────────────────

const NOTE = {
  C3: 130.81, G3: 196.00,
  C4: 261.63, E4: 329.63, G4: 392.00, A4: 440.00,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
  C6: 1046.50,
} as const;

// ─── Just intonation ratios ────────────────────────────────────
//
// Pure small-integer ratios eliminate harmonic beating in chord voices.
// Major third: 5/4 = 386¢ vs TET 400¢ (−14¢ = zero beating between 4th/5th harmonics)
// Minor third: 6/5 = 316¢ vs TET 300¢ (+16¢ = pure minor 3rd)
// Perfect fifth: 3/2 = 702¢ vs TET 700¢ (≈ same, nearly perfect in TET)
// Perfect fourth: 4/3 = 498¢ vs TET 500¢ (≈ same)
const JI_MAJ3 = 5 / 4;
const JI_MIN3 = 6 / 5;
const JI_P5   = 3 / 2;
const JI_P4   = 4 / 3;

// ─── Chord progression system ─────────────────────────────────
//
// Each chord is a set of "valid" frequencies voices should prefer.
// The progression advances every CHORD_DURATION_SEC.
// Calm progression: I → VI → IV → II (circular)
// Tense progression (tension > 0.6): I → VIm → IVsus → V
//
// Chord tones use just intonation intervals computed from each chord root.
// Voices voice-lead between these frequencies — slight detuning from TET is
// inaudible at the tempo of ambient music, but harmonic purity is perceived.

type Chord = { name: string; root: number; tones: number[] };

const PROGRESSION_CALM: Chord[] = [
  // I: C major — JI major third and fifth, two octaves
  { name: 'I',  root: NOTE.C4, tones: [
    NOTE.C4, NOTE.C4 * JI_MAJ3, NOTE.C4 * JI_P5,          // C4, E4_JI(327), G4_JI(392)
    NOTE.C5, NOTE.C5 * JI_MAJ3, NOTE.C5 * JI_P5, NOTE.C6, // C5, E5_JI(654), G5_JI(785), C6
  ] },
  // VI: A minor — JI minor third (528 Hz vs TET C5=523), pure fifth
  { name: 'VI', root: NOTE.A4, tones: [
    NOTE.A4, NOTE.A4 * JI_MIN3, NOTE.A4 * JI_P5, NOTE.A5, // A4, C5_JI(528), E5_JI(660), A5
  ] },
  // IV: G suspended — JI perfect fourth and fifth (almost identical to TET)
  { name: 'IV', root: NOTE.G4, tones: [
    NOTE.G4, NOTE.G4 * JI_P4, NOTE.G4 * JI_P5, NOTE.G4 * 2, // G4, C5_JI(523), D5_JI(588), G5
  ] },
  // II: E minor — JI minor third and fifth from E4 root
  { name: 'II', root: NOTE.E4, tones: [
    NOTE.E4, NOTE.E4 * JI_MIN3, NOTE.E4 * JI_P5, NOTE.E5, NOTE.E5 * JI_MIN3, // E4, G4_JI(396), B4_JI(494), E5, G5_JI(791)
  ] },
];

const PROGRESSION_TENSE: Chord[] = [
  // I: C major triad, JI
  { name: 'I',     root: NOTE.C4, tones: [NOTE.C4, NOTE.C4 * JI_MAJ3, NOTE.C4 * JI_P5, NOTE.C5] },
  // VIm: A minor, JI
  { name: 'VIm',   root: NOTE.A4, tones: [NOTE.A4, NOTE.A4 * JI_MIN3, NOTE.A4 * JI_P5] },
  // IVsus: G suspended, JI
  { name: 'IVsus', root: NOTE.G4, tones: [NOTE.G4, NOTE.G4 * JI_P4, NOTE.G4 * JI_P5] },
  // V: D7 shell — root, JI fifth, TET minor 7th (C6)
  { name: 'V',     root: NOTE.D5, tones: [NOTE.D5, NOTE.D5 * JI_P5, NOTE.C6] },
];

// Extreme-tension minor progression (Am → Em → Dm) — modal darkening above tension 0.8.
const PROGRESSION_EXTREME: Chord[] = [
  // Am: A minor, JI
  { name: 'Am', root: NOTE.A4, tones: [NOTE.A4, NOTE.A4 * JI_MIN3, NOTE.A4 * JI_P5, NOTE.A5] },
  // Em: E minor, JI
  { name: 'Em', root: NOTE.E4, tones: [NOTE.E4, NOTE.E4 * JI_MIN3, NOTE.E4 * JI_P5, NOTE.E5] },
  // Dm: D minor — JI minor third and fifth
  { name: 'Dm', root: NOTE.D5, tones: [NOTE.D5, NOTE.D5 * JI_MIN3, NOTE.D5 * JI_P5] },
];

const CHORD_DURATION_SEC = 20;

// ─── Voice config ─────────────────────────────────────────────

type VoiceConfig = {
  name: string;
  cycleSec: number;
  paceInfluence: number;
  calmPool: number[];
  tensePool: number[];
  oscType: OscillatorType;
  baseVol: number;
  attack: number;
  sustain: number;
  release: number;
  paceMult?: number;
  streakSubdivide?: boolean;
  pan?: number;
  tapeWobble?: boolean;  // tape wow/flutter pitch LFOs (lo-fi piano)
  karplus?: boolean;     // Karplus-Strong synthesis instead of oscillator
  fmBell?: boolean;      // FM bell synthesis (Chowning — carrier + inharmonic modulator)
  amBreath?: boolean;    // AM breathing (3 Hz tremolo on output amplitude)
  markov?: boolean;      // Markov-chain note selection (second-order, tension-biased)
  modal?: boolean;       // Modal synthesis — inharmonic bandpass resonator bank (marimba/vibe)
};

// ─── Beat clock grid (pulse theme) ────────────────────────────

type GridVoice = { name: string; beatInterval: number };

// beatInterval in quarter-note beats: 0.5 = eighth, 1 = quarter, 2 = half, etc.
const PULSE_GRID_VOICES: GridVoice[] = [
  { name: 'bass',   beatInterval: 1   },
  { name: 'stab',   beatInterval: 2   },
  { name: 'lead',   beatInterval: 3   },
  { name: 'accent', beatInterval: 4   },
  { name: 'arp',    beatInterval: 0.5 },
];

// ─── Theme: Ambient ───────────────────────────────────────────

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
    cycleSec: 16, paceInfluence: 0.3, // 16s (3:4 polyrhythm with shimmer at 12s)
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
    cycleSec: 12, paceInfluence: 0.15, // 12s (3:4 polyrhythm with padMid at 16s — align every 48s)
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
  {
    // Markov lead: a melodic voice that follows smooth voice leading at low tension
    // and ventures into leaps + higher scale degrees as tension climbs.
    name: 'markovLead',
    cycleSec: 3.5, paceInfluence: 0.7,
    calmPool: [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5],
    tensePool: [NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6],
    oscType: 'sine', baseVol: 0.013,
    attack: 0.10, sustain: 0.35, release: 0.45,
    pan: -0.15, markov: true,
  },
];

// ─── Theme: Pulse ─────────────────────────────────────────────

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

// ─── Theme: Lo-fi ─────────────────────────────────────────────
//
// Piano: Karplus-Strong + tape wobble. tensePool excludes A4 (2.27ms delay
// is borderline for DelayNode on some browsers).
// lowChord + hiNote: PeriodicWave electric-piano timbre.
// Arp: 8% swing via alternating long/short intervals.

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
  {
    // Marimba: modal synthesis voice — physically modeled bar percussion.
    // Wider note range than piano to fill the mellow lo-fi texture with something tactile.
    name: 'marimba',
    cycleSec: 3.0, paceInfluence: 0.5,
    calmPool: [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5],
    tensePool: [NOTE.C4, NOTE.G4, NOTE.C5],
    oscType: 'sine', baseVol: 0.020, // passed to modalStrike as vol
    attack: 0.01, sustain: 0.0, release: 1.8, // release controls modal decay (not envelope)
    pan: 0.25, modal: true,
  },
];

// ─── Theme: Drift ─────────────────────────────────────────────
//
// Eno × ocean aesthetic. Sparse, very long cycles, no beat clock.
// bellTone: FM synthesis (Chowning bell — inharmonic attack, pure tail)
// breathPad: AM breath (3 Hz tremolo — cassette bellows effect)
// waterDrop: Karplus-Strong pluck (percussive droplet)
// deepSub: pure sine at C3/G3 — felt more than heard on phone speakers

const VOICES_DRIFT: VoiceConfig[] = [
  {
    name: 'oceanPad',
    cycleSec: 18, paceInfluence: 0.1,
    calmPool: [NOTE.C4, NOTE.G4, NOTE.C5], tensePool: [NOTE.C4, NOTE.E4, NOTE.G4],
    oscType: 'sine', baseVol: 0.028,
    attack: 4, sustain: 12, release: 6,
    pan: 0.0,
  },
  {
    name: 'bellTone',
    cycleSec: 12, paceInfluence: 0.3,
    calmPool: [NOTE.E5, NOTE.G5, NOTE.C6], tensePool: [NOTE.A4, NOTE.D5, NOTE.E5],
    oscType: 'sine', baseVol: 0.022,
    attack: 0.01, sustain: 0.0, release: 3.0,
    pan: 0.0, fmBell: true,
  },
  {
    name: 'breathPad',
    cycleSec: 14, paceInfluence: 0.2,
    calmPool: [NOTE.G4, NOTE.C5, NOTE.E5], tensePool: [NOTE.E4, NOTE.G4, NOTE.A4],
    oscType: 'sine', baseVol: 0.020,
    attack: 3, sustain: 8, release: 5,
    pan: 0.3, amBreath: true,
  },
  {
    name: 'waterDrop',
    cycleSec: 3, paceInfluence: 1.0,
    calmPool: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6],
    tensePool: [NOTE.A4, NOTE.C5, NOTE.D5],
    oscType: 'sine', baseVol: 0.025,
    attack: 0.01, sustain: 0.3, release: 1.2,
    paceMult: 3.0, streakSubdivide: true,
    pan: 0.0, karplus: true,
  },
  {
    name: 'deepSub',
    cycleSec: 30, paceInfluence: 0.05,
    calmPool: [NOTE.C3, NOTE.G3], tensePool: [NOTE.C3, NOTE.G3],
    oscType: 'sine', baseVol: 0.015,
    attack: 5, sustain: 20, release: 8,
    pan: 0.0,
  },
];

// ─── A3: Binaural beat state ───────────────────────────────────

let binauralL: OscillatorNode | null = null;
let binauralR: OscillatorNode | null = null;
let binauralGain: GainNode | null = null;

// ─── Engine state ─────────────────────────────────────────────

let ambientGain: GainNode | null = null;
let lfo: OscillatorNode | null = null;
let lfoGainNode: GainNode | null = null;
let voiceTimers: ReturnType<typeof setTimeout>[] = [];
let running = false;
let paused = false;
// Crossfade: increment on theme switch so old timers self-terminate at next fire
let themeGeneration = 0;
let tension = 0;
let streak = 0;
let paceMs = 5000;
let arpIndex = 0;
let currentTheme: MusicTheme = 'ambient';
let prevTensionTier = -1; // -1 = not yet initialized; 0=calm, 1=tense, 2=extreme

// Effect chain (sat + reverb, rebuilt per theme)
let satNode: WaveShaperNode | null = null;
let convolver: ConvolverNode | null = null;
let reverbDryGain: GainNode | null = null;
let reverbWetGain: GainNode | null = null;

// Ping-pong delay (ambient arp only)
let pingPongInput: GainNode | null = null;
let pingPongDelayL: DelayNode | null = null;
let pingPongDelayR: DelayNode | null = null;
let pingPongFbL: GainNode | null = null;
let pingPongFbR: GainNode | null = null;
let pingPongPanL: StereoPannerNode | null = null;
let pingPongPanR: StereoPannerNode | null = null;
let pingPongWet: GainNode | null = null;

// Beat clock (pulse theme)
let beatClockTimer: ReturnType<typeof setInterval> | null = null;
let nextBeatTime = 0;
let beatDuration = 0.5;   // seconds per quarter note
let halfBeatCount = 0;    // eighth-note grid counter (increments each scheduler tick)
const LOOK_AHEAD_SEC = 0.1;
const SCHEDULE_INTERVAL_MS = 25;

// PeriodicWave for lo-fi electric-piano timbre (created once per session)
let electricPianoWave: PeriodicWave | null = null;

// Chord system
let currentChord: Chord = PROGRESSION_CALM[0];
let chordIndex = 0;
let chordStartSec = 0;
const lastNotePerVoice = new Map<string, number>();

// Swing (lo-fi arp alternating interval)
let lofiArpFireCount = 0;
const SWING_AMOUNT = 0.08;

// Motif development: arp follows a pool-index pattern that evolves every 4 chord changes
let motifPattern: number[] = [0, 2, 1, 3, 0, 1, 2, 0];
let motifPos = 0;
let chordChangeCount = 0;

// Markov melody: second-order chain over pool indices (−1 = no history)
let markovPrev1 = -1; // pool index of the previous note
let markovPrev2 = -1; // pool index of the note before that

const AMBIENT_BASE_VOL = 0.06;
const LFO_DEPTH = 0.025;
const DEFAULT_LFO_FREQ = 0.25;
const REFERENCE_PACE_MS = 5000;
const PACE_MULT = 2.5;

// ─── Effect chain: saturation + reverb ────────────────────────

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
    case 'pulse': return { duration: 0.3, decay: 8.0, wet: 0.12, satDrive: 1.5 };
    case 'lofi':  return { duration: 0.6, decay: 6.0, wet: 0.20, satDrive: 3.0 };
    case 'drift': return { duration: 3.5, decay: 2.0, wet: 0.55, satDrive: 1.5 };
    default:      return { duration: 2.5, decay: 3.0, wet: 0.38, satDrive: 2.0 };
  }
}

/**
 * Build ping-pong delay for ambient arp:
 *   pingPongInput → delayL → panL (-0.8) → pingPongWet → ambientGain
 *                 → delayL → fbL → delayR → panR (+0.8) → pingPongWet
 *                                 delayR → fbR → delayL (loop)
 *   pingPongInput → ambientGain (dry)
 */
function buildPingPong(ac: AudioContext): void {
  const delayTime = Math.max(0.1, Math.min(1.2, paceMs / 3000));

  pingPongInput = ac.createGain();
  pingPongDelayL = ac.createDelay(2.0);
  pingPongDelayR = ac.createDelay(2.0);
  pingPongDelayL.delayTime.value = delayTime;
  pingPongDelayR.delayTime.value = delayTime;

  pingPongFbL = ac.createGain();
  pingPongFbR = ac.createGain();
  pingPongFbL.gain.value = 0.5;
  pingPongFbR.gain.value = 0.5;

  pingPongPanL = ac.createStereoPanner();
  pingPongPanR = ac.createStereoPanner();
  pingPongPanL.pan.value = -0.8;
  pingPongPanR.pan.value = 0.8;

  pingPongWet = ac.createGain();
  pingPongWet.gain.value = 0.25;

  pingPongInput.connect(pingPongDelayL);
  pingPongDelayL.connect(pingPongFbL);
  pingPongFbL.connect(pingPongDelayR);
  pingPongDelayR.connect(pingPongFbR);
  pingPongFbR.connect(pingPongDelayL);
  pingPongDelayL.connect(pingPongPanL);
  pingPongDelayR.connect(pingPongPanR);
  pingPongPanL.connect(pingPongWet);
  pingPongPanR.connect(pingPongWet);
  pingPongWet.connect(ambientGain!);
  pingPongInput.connect(ambientGain!); // dry pass-through
}

function tearDownPingPong(): void {
  try { pingPongInput?.disconnect(); }  catch { /* */ }
  try { pingPongDelayL?.disconnect(); } catch { /* */ }
  try { pingPongDelayR?.disconnect(); } catch { /* */ }
  try { pingPongFbL?.disconnect(); }    catch { /* */ }
  try { pingPongFbR?.disconnect(); }    catch { /* */ }
  try { pingPongPanL?.disconnect(); }   catch { /* */ }
  try { pingPongPanR?.disconnect(); }   catch { /* */ }
  try { pingPongWet?.disconnect(); }    catch { /* */ }
  pingPongInput = pingPongDelayL = pingPongDelayR = null;
  pingPongFbL = pingPongFbR = null;
  pingPongPanL = pingPongPanR = null;
  pingPongWet = null;
}

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

  // Ping-pong delay for the ambient arp voice
  if (currentTheme === 'ambient') {
    buildPingPong(ac);
  }
}

function tearDownEffectChain(): void {
  tearDownPingPong();
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

// ─── A3: Binaural beat entrainment ────────────────────────────

/**
 * Two sine oscillators at 100 Hz, hard-panned L/R, with the right ear
 * running slightly higher. The difference frequency (10–20 Hz) is perceived
 * by the brain as a rhythmic beat via binaural processing — only audible on headphones.
 * At calm tension: 10 Hz (alpha band — focus). At high tension: 20 Hz (beta band — alert).
 *
 * Carriers at 100 Hz are sub-threshold on phone speakers but reach IEMs/headphones.
 * Volume is very low (0.008) — the effect is subliminal, not heard as a distinct tone.
 */
function startBinaural(ac: AudioContext): void {
  if (binauralL) return; // already running
  const panL = ac.createStereoPanner();
  const panR = ac.createStereoPanner();
  panL.pan.value = -1;
  panR.pan.value = 1;

  binauralGain = ac.createGain();
  binauralGain.gain.value = 0.008; // sub-threshold on speakers, present on headphones

  binauralL = ac.createOscillator();
  binauralR = ac.createOscillator();
  binauralL.type = 'sine';
  binauralR.type = 'sine';
  binauralL.frequency.value = 100;       // carrier
  binauralR.frequency.value = 110;       // carrier + 10 Hz beat = alpha band

  binauralL.connect(panL);
  binauralR.connect(panR);
  panL.connect(binauralGain);
  panR.connect(binauralGain);
  binauralGain.connect(getMaster());

  binauralL.start();
  binauralR.start();
}

function stopBinaural(): void {
  try { binauralL?.stop(); }    catch { /* */ }
  try { binauralR?.stop(); }    catch { /* */ }
  try { binauralL?.disconnect(); } catch { /* */ }
  try { binauralR?.disconnect(); } catch { /* */ }
  try { binauralGain?.disconnect(); } catch { /* */ }
  binauralL = null;
  binauralR = null;
  binauralGain = null;
}

/** Shift beat frequency with tension: 10 Hz (alpha/focus) → 20 Hz (beta/alert). */
function updateBinauralBeat(t: number): void {
  if (!binauralR) return;
  const beatFreq = 10 + t * 10; // 10–20 Hz as tension rises
  binauralR.frequency.setTargetAtTime(100 + beatFreq, getCtx().currentTime, 3.0);
}

// ─── C4: Tension-reactive reverb morphing ─────────────────────

/**
 * Three reverb tiers driven by tension level:
 *   Calm (0–0.5):   2.5s hall — spacious and open
 *   Tense (0.5–0.8): 1.0s tight room — walls closing in
 *   Extreme (0.8+):  0.4s dead room — claustrophobic
 *
 * On tier crossing, the ConvolverNode's buffer is swapped.
 * The previous reverb tail fades naturally since existing in-flight audio
 * is processed by the old IR until it decays. In ambient pad context
 * (slow sustained notes) the buffer swap is imperceptible.
 */
function getTensionTier(t: number): number {
  if (t > 0.8) return 2;
  if (t > 0.5) return 1;
  return 0;
}

function morphReverb(newTier: number): void {
  if (!convolver) return;
  const cfgByTier = [
    { duration: 2.5, decay: 3.0 },  // calm: spacious hall
    { duration: 1.0, decay: 6.0 },  // tense: tight room
    { duration: 0.4, decay: 10.0 }, // extreme: dead/claustrophobic
  ];
  const cfg = cfgByTier[Math.min(newTier, 2)];
  convolver.buffer = buildIR(getCtx(), cfg.duration, cfg.decay);
}

// ─── PeriodicWave: electric piano timbre ──────────────────────

/**
 * Electric piano wave: strong fundamental, warm 2nd harmonic, subtle 3rd/4th.
 * Applied to lo-fi lowChord and hiNote voices (not arp or shimmer).
 */
function buildElectricPianoWave(ac: AudioContext): PeriodicWave {
  const N = 8;
  const real = new Float32Array(new ArrayBuffer(N * 4));
  const imag = new Float32Array(new ArrayBuffer(N * 4));
  imag[1] = 1.0;  // fundamental
  imag[2] = 0.4;  // 2nd harmonic (octave up — adds warmth)
  imag[3] = 0.15; // 3rd — subtle bell character
  imag[4] = 0.05; // 4th — barely present
  return ac.createPeriodicWave(real, imag, { disableNormalization: false });
}

// ─── Karplus-Strong string synthesis ──────────────────────────

function karplusPluck(freq: number, vol: number, pan: number): void {
  if (!ambientGain) return;
  const ac = getCtx();
  const t = ac.currentTime;

  const delayTime = Math.max(0.003, 1 / freq);
  const duration = 2.0;
  const burstDur = Math.max(delayTime * 3, 0.02);

  const bufSize = Math.ceil(ac.sampleRate * burstDur);
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const burst = ac.createBufferSource();
  burst.buffer = buf;

  const delay = ac.createDelay(0.1);
  delay.delayTime.value = delayTime;

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.min(freq * 5, 4000);
  filter.Q.value = 0.5;

  const feedback = ac.createGain();
  feedback.gain.value = 0.982;

  const outGain = ac.createGain();
  outGain.gain.setValueAtTime(vol, t);
  outGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  const panner = ac.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan + (Math.random() - 0.5) * 0.08));

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

// ─── B1: Modal synthesis — marimba/vibraphone resonator bank ─────

/**
 * Marimba modal ratios measured from real bar acoustics.
 * Integer harmonics (f, 2f, 3f) produce a boring string tone.
 * These inharmonic ratios give the characteristic warm thud + bright ring.
 * decaySec controls how long each mode sustains — lower modes ring longer.
 */
const MARIMBA_MODES = [
  { ratio: 1.00, amp: 1.0,  decaySec: 1.8  }, // fundamental — long warm ring
  { ratio: 3.99, amp: 0.45, decaySec: 0.6  }, // 2nd transverse mode (~4× fundamental)
  { ratio: 9.87, amp: 0.15, decaySec: 0.3  }, // 3rd transverse mode (~10× fundamental)
  { ratio: 19.5, amp: 0.06, decaySec: 0.15 }, // 4th transverse mode
  { ratio: 2.76, amp: 0.20, decaySec: 0.4  }, // torsional mode
  { ratio: 5.40, amp: 0.08, decaySec: 0.2  }, // 2nd torsional
];

/**
 * Modal synthesis: a short noise burst excites a bank of exponentially-decaying
 * BiquadFilter bandpass resonators tuned to each acoustic mode of a marimba bar.
 * The resulting timbre is immediately recognizable and distinct from any oscillator voice.
 */
function modalStrike(freq: number, vol: number, pan: number): void {
  if (!ambientGain) return;
  const ac = getCtx();
  const t = ac.currentTime;

  // Short noise burst as the mallet impulse (4ms)
  const burstLen = Math.ceil(ac.sampleRate * 0.004);
  const buf = ac.createBuffer(1, burstLen, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < burstLen; i++) data[i] = Math.random() * 2 - 1;

  const burst = ac.createBufferSource();
  burst.buffer = buf;

  const panner = ac.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan + (Math.random() - 0.5) * 0.14));

  const sumGain = ac.createGain();
  sumGain.gain.value = vol;

  MARIMBA_MODES.forEach(mode => {
    const modeFreq = freq * mode.ratio;
    if (modeFreq > ac.sampleRate / 2 - 200) return; // skip above Nyquist

    const bpf = ac.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = modeFreq;
    bpf.Q.value = modeFreq / 25; // Q scales with frequency for natural modal damping

    const modeGain = ac.createGain();
    modeGain.gain.setValueAtTime(mode.amp, t);
    modeGain.gain.setTargetAtTime(0.0001, t + 0.005, mode.decaySec / 3);

    burst.connect(bpf);
    bpf.connect(modeGain);
    modeGain.connect(sumGain);

    setTimeout(() => {
      try { bpf.disconnect(); modeGain.disconnect(); } catch { /* */ }
    }, (mode.decaySec + 0.5) * 1000);
  });

  sumGain.connect(panner);
  panner.connect(ambientGain!);

  burst.start(t);
  burst.stop(t + 0.01);
  burst.onended = () => {
    try { burst.disconnect(); sumGain.disconnect(); panner.disconnect(); } catch { /* */ }
  };
}

// ─── FM bell synthesis (Drift theme bellTone voice) ───────────

/**
 * Classic Chowning FM bell: inharmonic modulator (ratio 1.4) gives bright attack
 * transient; modulation index decays to zero leaving a pure sine tail.
 * Bell strikes alternate L/R pan for spatial drift character.
 */
function fmBell(freq: number, cfg: VoiceConfig, volMult: number): void {
  if (!ambientGain) return;
  const ac = getCtx();
  const t = ac.currentTime;

  const carrier   = ac.createOscillator();
  const modulator = ac.createOscillator();
  const modGain   = ac.createGain();
  const envGain   = ac.createGain();
  const panner    = ac.createStereoPanner();

  carrier.type   = 'sine';
  carrier.frequency.value = freq;
  modulator.type = 'sine';
  modulator.frequency.value = freq * 1.4; // slightly inharmonic = bell character

  // Modulation index: bright transient on attack → pure sine on decay
  const totalDur = cfg.attack + cfg.sustain + cfg.release;
  modGain.gain.setValueAtTime(freq * 3, t);
  modGain.gain.exponentialRampToValueAtTime(0.001, t + Math.min(totalDur * 0.6, 2.0));

  // Bell amplitude: sharp attack, long exponential decay
  const peakVol = cfg.baseVol * volMult;
  envGain.gain.setValueAtTime(0.0001, t);
  envGain.gain.linearRampToValueAtTime(peakVol, t + cfg.attack);
  envGain.gain.exponentialRampToValueAtTime(0.0001, t + totalDur);

  // Wide alternating stereo — bells drift L/R to fill the space
  panner.pan.value = Math.max(-1, Math.min(1, (Math.random() < 0.5 ? 0.65 : -0.65)));

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(envGain);
  envGain.connect(panner);
  panner.connect(ambientGain!);

  carrier.start(t);
  modulator.start(t);
  carrier.stop(t + totalDur + 0.05);
  modulator.stop(t + totalDur + 0.05);

  carrier.onended = () => {
    try { carrier.disconnect(); }   catch { /* */ }
    try { modulator.disconnect(); } catch { /* */ }
    try { modGain.disconnect(); }   catch { /* */ }
    try { envGain.disconnect(); }   catch { /* */ }
    try { panner.disconnect(); }    catch { /* */ }
  };
}

// ─── Beat clock (pulse theme) ─────────────────────────────────

/**
 * Derive quarter-note duration from average pace.
 * Slow play (5000ms/piece) → 80 BPM; fast play (1500ms/piece) → 140 BPM.
 */
function deriveBeatDuration(pm: number): number {
  const bpm = 80 + ((5000 - Math.min(pm, 5000)) / 3500) * 60;
  return 60 / Math.max(80, Math.min(140, bpm));
}

/**
 * 4-note 16th-note roll fill, landing 2 beats before the next section boundary.
 * Uses current chord tones for harmonic consonance.
 */
function scheduleRollFill(startTime: number): void {
  if (!ambientGain) return;
  const ac = getCtx();
  const sixteenth = beatDuration / 4;
  const fillFreqs = [
    currentChord.tones[2] ?? 783.99,
    currentChord.tones[3] ?? 880.00,
    currentChord.tones[Math.min(4, currentChord.tones.length - 1)] ?? 1046.50,
    currentChord.tones[2] ?? 783.99,
  ];
  fillFreqs.forEach((freq, i) => {
    const t = startTime + i * sixteenth;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.018 + i * 0.006, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + sixteenth * 0.9);
    osc.connect(gain);
    gain.connect(ambientGain!);
    osc.start(t);
    osc.stop(t + sixteenth);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  });
}

/**
 * Schedule all pulse voices that fall on this eighth-note grid position.
 * Uses AudioContext startTime (not setTimeout) so notes lock to the grid exactly.
 * Every 32 beats (64 eighth notes), a 16th-note fill roll is triggered.
 */
function scheduleBeatEvents(beatTime: number): void {
  // Fill: 4 sixteenth-note roll, 2 beats before section boundary (every 32 beats)
  if (halfBeatCount > 0 && halfBeatCount % 64 === 60) {
    scheduleRollFill(beatTime);
  }

  for (const gv of PULSE_GRID_VOICES) {
    // Convert beat interval to eighth-note grid count (0.5 beats = 1 grid tick)
    const intervalInEighths = Math.round(gv.beatInterval * 2);
    if (intervalInEighths > 0 && halfBeatCount % intervalInEighths !== 0) continue;

    const voiceCfg = VOICES_PULSE.find(v => v.name === gv.name);
    if (!voiceCfg) continue;

    const volMult = getVoiceVolMult(gv.name, tension);
    if (volMult < 0.01) continue;

    const isArp = gv.name === 'arp';
    const freq = isArp ? getArpNote(voiceCfg) : pickChordNote(voiceCfg);

    playNote(freq, voiceCfg, volMult, beatTime);

    if (isArp && streak >= 8) {
      playNote(freq * 2, voiceCfg, volMult * 0.5, beatTime);
    }
  }
  halfBeatCount++;
}

function startBeatClock(): void {
  const ac = getCtx();
  beatDuration = deriveBeatDuration(paceMs);
  nextBeatTime = ac.currentTime + 0.1;
  halfBeatCount = 0;

  beatClockTimer = setInterval(() => {
    if (!running || paused) return;
    const now = ac.currentTime;
    // Schedule all eighth-note grid positions within the look-ahead window
    while (nextBeatTime < now + LOOK_AHEAD_SEC) {
      scheduleBeatEvents(nextBeatTime);
      nextBeatTime += beatDuration / 2; // eighth-note step
    }
  }, SCHEDULE_INTERVAL_MS);
}

function stopBeatClock(): void {
  if (beatClockTimer !== null) {
    clearInterval(beatClockTimer);
    beatClockTimer = null;
  }
}

// ─── Chord system helpers ─────────────────────────────────────

/**
 * Transform the arp motif pattern every 4 chord changes to prevent staleness.
 * Choices: retrograde, octave-shift (index +1), trim or extend.
 */
function developMotif(): void {
  const choice = Math.floor(Math.random() * 3);
  if (choice === 0) {
    motifPattern = [...motifPattern].reverse();
  } else if (choice === 1) {
    motifPattern = motifPattern.map(n => n + 1);
  } else if (motifPattern.length > 3) {
    motifPattern = motifPattern.slice(0, motifPattern.length - 1);
  } else {
    motifPattern = [...motifPattern, motifPattern[Math.floor(Math.random() * motifPattern.length)]];
  }
}

/**
 * Advance the chord progression if CHORD_DURATION_SEC has elapsed.
 * Three tiers: calm (≤0.6) → tense (>0.6) → extreme minor (>0.8).
 * Every 4 chord changes, the arp motif pattern is developed.
 */
function updateChord(): void {
  const nowSec = Date.now() / 1000;
  if (nowSec - chordStartSec < CHORD_DURATION_SEC) return;

  const progression = tension > 0.8 ? PROGRESSION_EXTREME
    : tension > 0.6 ? PROGRESSION_TENSE
    : PROGRESSION_CALM;
  chordIndex = (chordIndex + 1) % progression.length;
  currentChord = progression[chordIndex];
  chordStartSec = nowSec;

  chordChangeCount++;
  if (chordChangeCount % 4 === 0) developMotif();
}

/**
 * Returns true if freq and chordFreq share the same pitch class
 * (i.e., they're within ~100 cents of being octave multiples of each other).
 */
function sameHarmonic(freq: number, chordFreq: number): boolean {
  let ratio = freq / chordFreq;
  while (ratio >= 2) ratio /= 2;
  while (ratio < 1) ratio *= 2;
  // ratio is now in [1, 2); ratio ≈ 1 means same pitch class
  return ratio < 1.06 || ratio > 1.94;
}

/**
 * Pick a note for a voice that is:
 *   1. From the tension-appropriate pool (calm or tense)
 *   2. Consonant with the current chord (falls back to full pool if none match)
 *   3. Closest in pitch to the voice's previous note (voice leading)
 */
function pickChordNote(cfg: VoiceConfig): number {
  updateChord();

  const pool = tension > 0.5 ? cfg.tensePool : cfg.calmPool;
  const consonant = pool.filter(f => currentChord.tones.some(ct => sameHarmonic(f, ct)));
  const candidates = consonant.length > 0 ? consonant : pool;

  // Voice leading: minimise log-frequency distance from previous note
  const lastName = lastNotePerVoice.get(cfg.name);
  let note: number;
  if (lastName && candidates.length > 1) {
    note = candidates.reduce((best, candidate) =>
      Math.abs(Math.log2(candidate / lastName)) < Math.abs(Math.log2(best / lastName))
        ? candidate : best,
    );
  } else {
    note = candidates[Math.floor(Math.random() * candidates.length)];
  }

  lastNotePerVoice.set(cfg.name, note);
  return note;
}

// ─── Internal helpers ─────────────────────────────────────────

function getVoices(): VoiceConfig[] {
  switch (currentTheme) {
    case 'pulse': return VOICES_PULSE;
    case 'lofi':  return VOICES_LOFI;
    case 'drift': return VOICES_DRIFT;
    default:      return VOICES_AMBIENT;
  }
}

/**
 * Get the next arp note using the evolving motif pattern.
 * The motif is a sequence of pool-index offsets that cycles and transforms
 * every 4 chord changes via developMotif() — prevents mechanical repetition.
 */
function getArpNote(cfg: VoiceConfig): number {
  updateChord();
  const pool = tension > 0.5 ? cfg.tensePool : cfg.calmPool;
  const chordPool = pool.filter(f => currentChord.tones.some(ct => sameHarmonic(f, ct)));
  const activePool = chordPool.length > 0 ? chordPool : pool;
  const idx = motifPattern[motifPos % motifPattern.length] % activePool.length;
  motifPos++;
  arpIndex++;
  return activePool[idx];
}

/**
 * Pick the next Markov melody note.
 *
 * Second-order Markov chain over pool indices:
 * - Step bias: exponential distance penalty, strong at low tension, flattens at high tension
 * - Directional momentum: 1.3× bonus for continuing previous direction, 0.8× for reversing
 * - Tonic gravity: slight pull toward pool center at low tension (keeps melody grounded)
 *
 * At tension=0: strongly favors step motion (adjacent degrees).
 * At tension=1: almost uniform distribution — wide leaps and surprise skips.
 */
function getMarkovNote(cfg: VoiceConfig): number {
  updateChord();
  const pool = tension > 0.5 ? cfg.tensePool : cfg.calmPool;
  const chordPool = pool.filter(f => currentChord.tones.some(ct => sameHarmonic(f, ct)));
  const activePool = chordPool.length > 0 ? chordPool : pool;
  const n = activePool.length;

  if (markovPrev1 < 0 || markovPrev1 >= n) {
    // No history or pool size changed — seed at the middle of the pool
    const idx = Math.floor(n / 2);
    markovPrev2 = -1;
    markovPrev1 = idx;
    return activePool[idx];
  }

  const weights: number[] = [];
  for (let i = 0; i < n; i++) {
    const dist = Math.abs(i - markovPrev1);
    // Step bias: prefer close motion at low tension, allow leaps at high tension
    const stepBias = Math.exp(-dist * (2.5 - tension * 2.0));
    // Directional momentum (second-order): bonus for continuing the previous direction
    let dirBonus = 1.0;
    if (markovPrev2 >= 0) {
      const prevDir = markovPrev1 - markovPrev2;
      const currDir = i - markovPrev1;
      dirBonus = ((prevDir > 0 && currDir > 0) || (prevDir < 0 && currDir < 0)) ? 1.3 : 0.8;
    }
    // Tonic gravity: pull toward pool center at low tension
    const center = Math.floor(n / 2);
    const tonicPull = 1 + 0.1 * Math.exp(-Math.abs(i - center) * (1 - tension));
    weights.push(stepBias * dirBonus * tonicPull);
  }

  // Weighted random draw
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let chosen = n - 1;
  for (let i = 0; i < n; i++) {
    r -= weights[i];
    if (r <= 0) { chosen = i; break; }
  }

  markovPrev2 = markovPrev1;
  markovPrev1 = chosen;
  return activePool[chosen];
}

/**
 * Play one oscillator note, scheduled at startTime (defaults to ac.currentTime).
 *
 * Signal chain:
 *   osc → gain → [padFilter?] → panner → [pingPongInput | ambientGain]
 *
 * - Ambient pad voices get a tension-driven lowpass filter (3000→600 Hz)
 * - Lo-fi lowChord+hiNote get PeriodicWave electric-piano timbre
 * - Lo-fi piano gets tape wow/flutter (tapeWobble flag)
 * - Ambient arp routes through pingPongInput (ping-pong delay)
 */
function playNote(freq: number, cfg: VoiceConfig, volMult: number, startTime?: number): void {
  const ac = getCtx();
  const t = startTime ?? ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const panner = ac.createStereoPanner();

  // Timbre: PeriodicWave for lo-fi pitched voices
  if (electricPianoWave && currentTheme === 'lofi' && ['lowChord', 'hiNote'].includes(cfg.name)) {
    osc.setPeriodicWave(electricPianoWave);
  } else {
    osc.type = cfg.oscType;
  }

  osc.frequency.value = freq;
  osc.detune.value = (Math.random() - 0.5) * 16;

  const peakVol = cfg.baseVol * volMult;
  const totalDur = cfg.attack + cfg.sustain + cfg.release;

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peakVol, t + cfg.attack);
  gain.gain.setValueAtTime(peakVol, t + cfg.attack + cfg.sustain);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + totalDur);

  // Stereo placement
  const basePan = cfg.pan ?? 0;
  panner.pan.value = Math.max(-1, Math.min(1, basePan + (Math.random() - 0.5) * 0.1));

  // BiquadFilter tension sweep for ambient pad voices
  // At tension=0: 3000 Hz (bright/open). At tension=1: 600 Hz (dark/oppressive).
  let padFilter: BiquadFilterNode | null = null;
  if (currentTheme === 'ambient' && ['padLow', 'padMid', 'padHigh', 'shimmer'].includes(cfg.name)) {
    padFilter = ac.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 3000 - tension * 2400;
    padFilter.Q.value = 0.7;
    gain.connect(padFilter);
    padFilter.connect(panner);
  } else {
    gain.connect(panner);
  }

  // Tape wow + flutter for lo-fi cassette character
  let wowLfo: OscillatorNode | null = null;
  let wowGain: GainNode | null = null;
  let flutterLfo: OscillatorNode | null = null;
  let flutterGain: GainNode | null = null;

  if (cfg.tapeWobble) {
    wowLfo = ac.createOscillator();
    wowGain = ac.createGain();
    wowLfo.type = 'sine';
    wowLfo.frequency.value = 0.45 + Math.random() * 0.25;
    wowGain.gain.value = 4;
    wowLfo.connect(wowGain);
    wowGain.connect(osc.detune);

    flutterLfo = ac.createOscillator();
    flutterGain = ac.createGain();
    flutterLfo.type = 'sine';
    flutterLfo.frequency.value = 7 + Math.random() * 2.5;
    flutterGain.gain.value = 1.5;
    flutterLfo.connect(flutterGain);
    flutterGain.connect(osc.detune);

    wowLfo.start(t);
    flutterLfo.start(t);
  }

  // AM breath for drift breathPad — 3 Hz tremolo on output amplitude
  let breathMod: GainNode | null = null;
  let breathLfo: OscillatorNode | null = null;
  let breathDepth: GainNode | null = null;
  if (cfg.amBreath) {
    breathMod   = ac.createGain();
    breathLfo   = ac.createOscillator();
    breathDepth = ac.createGain();
    breathMod.gain.value   = 1.0;
    breathLfo.type         = 'sine';
    breathLfo.frequency.value = 3 + Math.random() * 0.4;
    breathDepth.gain.value = 0.4; // depth: amplitude swings 0.6–1.4
    breathLfo.connect(breathDepth);
    breathDepth.connect(breathMod.gain);
    breathLfo.start(t);
    breathLfo.stop(t + totalDur + 0.05);
  }

  // Route: ambient arp → ping-pong; breathPad → breathMod → dest; else → dest
  const dest = (cfg.name === 'arp' && currentTheme === 'ambient' && pingPongInput)
    ? pingPongInput
    : ambientGain!;

  if (breathMod) {
    panner.connect(breathMod);
    breathMod.connect(dest);
  } else {
    panner.connect(dest);
  }

  osc.connect(gain);
  osc.start(t);
  osc.stop(t + totalDur + 0.05);

  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
    padFilter?.disconnect();
    panner.disconnect();
    if (breathMod)   { breathMod.disconnect(); }
    if (breathLfo)   { try { breathLfo.stop(); }   catch { /* */ } breathLfo.disconnect(); }
    if (breathDepth) { breathDepth.disconnect(); }
    if (wowLfo)      { try { wowLfo.stop(); }      catch { /* */ } wowLfo.disconnect(); }
    if (wowGain)     { wowGain.disconnect(); }
    if (flutterLfo)  { try { flutterLfo.stop(); }  catch { /* */ } flutterLfo.disconnect(); }
    if (flutterGain) { flutterGain.disconnect(); }
  };
}

function getVoiceVolMult(name: string, t: number): number {
  switch (name) {
    case 'padLow':   return 0.7 + t * 0.6;
    case 'padMid':   return 1.0;
    case 'padHigh':  return 1.0 - t * 0.3;
    case 'bass':     return 0.7 + t * 0.5;
    case 'stab':     return 1.0 - t * 0.15;
    case 'lead':     return 0.8 + t * 0.35;
    case 'accent':   return 1.0 - t * 0.45;
    case 'lowChord': return 0.6 + t * 0.5;
    case 'piano':    return 1.0 - t * 0.1;
    case 'hiNote':   return 0.9 - t * 0.3;
    case 'shimmer':   return 1.0 - t * 0.5;
    // Drift theme voices
    case 'oceanPad':  return 0.6 + t * 0.5;  // swells under tension
    case 'bellTone':  return 1.0 - t * 0.3;  // fewer bells when tense
    case 'breathPad': return 0.7 + t * 0.4;  // breathes harder under pressure
    case 'waterDrop': {
      if (t > 0.9) return 0;               // silence in extreme tension
      if (streak <= 0) return 0.3;
      return 1.0;
    }
    case 'deepSub':   return 0.8 + t * 0.3;  // sub grows under pressure
    case 'arp': {
      if (t > 0.85) return 0;
      if (streak <= 0) return 0.3;
      if (streak <= 2) return 0.6;
      return 1.0;
    }
    case 'markovLead': return 0.7 + t * 0.4; // audible at all tensions; louder under pressure
    case 'marimba':   return 0.8 - t * 0.3; // quieter under tension (mallet percussion recedes)
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

/**
 * setTimeout-based voice scheduler for ambient + lo-fi themes.
 * Pulse theme uses startBeatClock() instead.
 * gen guards against old timers firing after a theme switch — they self-terminate.
 */
function scheduleVoice(idx: number, gen: number): void {
  if (!running || paused || gen !== themeGeneration) return;
  const voices = getVoices();
  if (idx >= voices.length) return;

  const cfg = voices[idx];
  const isArp = cfg.name === 'arp';
  const cycleSec = getEffectiveCycleSec(cfg);

  if (cycleSec <= 0) {
    voiceTimers[idx] = setTimeout(() => scheduleVoice(idx, gen), 2000);
    return;
  }

  const volMult = getVoiceVolMult(cfg.name, tension);
  if (volMult > 0.01) {
    const freq = isArp
      ? getArpNote(cfg)
      : cfg.markov
        ? getMarkovNote(cfg)
        : pickChordNote(cfg);

    if (cfg.modal) {
      modalStrike(freq, cfg.baseVol * volMult, cfg.pan ?? 0);
    } else if (cfg.karplus) {
      karplusPluck(freq, cfg.baseVol * volMult, cfg.pan ?? 0);
    } else if (cfg.fmBell) {
      fmBell(freq, cfg, volMult);
    } else {
      playNote(freq, cfg, volMult);
      if (isArp && streak >= 8) {
        playNote(freq * 2, cfg, volMult * 0.5);
      }
    }
  }

  // Swing for lo-fi arp: alternate 8% longer interval → "long-short" lilt
  const baseJitter = 1 + (Math.random() - 0.5) * 0.15;
  let interval = cycleSec * 1000 * baseJitter;
  if (isArp && currentTheme === 'lofi') {
    if (lofiArpFireCount % 2 === 0) interval *= (1 + SWING_AMOUNT);
    lofiArpFireCount++;
  }

  voiceTimers[idx] = setTimeout(() => scheduleVoice(idx, gen), interval);
}

function startVoiceTimers(stagger: number): void {
  const gen = themeGeneration;
  const voices = getVoices();
  for (let i = 0; i < voices.length; i++) {
    const delay = i * stagger + Math.random() * (stagger * 0.5);
    voiceTimers[i] = setTimeout(() => scheduleVoice(i, gen), delay);
  }
}

// ─── Public API ───────────────────────────────────────────────

export function startAmbient(): void {
  if (running) return;

  const ac = getCtx();
  const master = getMaster();

  // Initialise chord + motif state
  chordIndex = 0;
  currentChord = PROGRESSION_CALM[0];
  chordStartSec = Date.now() / 1000;
  lastNotePerVoice.clear();
  lofiArpFireCount = 0;
  arpIndex = 0;
  motifPattern = [0, 2, 1, 3, 0, 1, 2, 0];
  motifPos = 0;
  chordChangeCount = 0;
  prevTensionTier = -1; // reset so first setAmbientTension call initializes reverb
  markovPrev1 = -1;
  markovPrev2 = -1;

  // Build PeriodicWave for lo-fi timbre
  electricPianoWave = buildElectricPianoWave(ac);

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

  buildEffectChain(ac, master);

  running = true;
  paused = false;

  startBinaural(ac);

  if (currentTheme === 'pulse') {
    startBeatClock();
  } else {
    startVoiceTimers(1200);
  }
}

export function stopAmbient(): void {
  if (!running) return;

  stopBeatClock();
  for (const t of voiceTimers) clearTimeout(t);
  voiceTimers = [];

  running = false;
  paused = false;
  arpIndex = 0;
  lofiArpFireCount = 0;
  lastNotePerVoice.clear();
  stopBinaural();

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

    // Capture all node refs before nulling — disconnect deferred to after fade
    const refs = {
      gain: ambientGain, lfo, lfoGain: lfoGainNode,
      sat: satNode, conv: convolver, dry: reverbDryGain, wet: reverbWetGain,
      ppIn: pingPongInput, ppL: pingPongDelayL, ppR: pingPongDelayR,
      ppFbL: pingPongFbL, ppFbR: pingPongFbR,
      ppPanL: pingPongPanL, ppPanR: pingPongPanR, ppWet: pingPongWet,
    };

    setTimeout(() => {
      try { refs.lfo?.stop(); }          catch { /* */ }
      try { refs.lfo?.disconnect(); }    catch { /* */ }
      try { refs.lfoGain?.disconnect(); } catch { /* */ }
      try { refs.gain.disconnect(); }    catch { /* */ }
      try { refs.sat?.disconnect(); }    catch { /* */ }
      try { refs.conv?.disconnect(); }   catch { /* */ }
      try { refs.dry?.disconnect(); }    catch { /* */ }
      try { refs.wet?.disconnect(); }    catch { /* */ }
      try { refs.ppIn?.disconnect(); }   catch { /* */ }
      try { refs.ppL?.disconnect(); }    catch { /* */ }
      try { refs.ppR?.disconnect(); }    catch { /* */ }
      try { refs.ppFbL?.disconnect(); }  catch { /* */ }
      try { refs.ppFbR?.disconnect(); }  catch { /* */ }
      try { refs.ppPanL?.disconnect(); } catch { /* */ }
      try { refs.ppPanR?.disconnect(); } catch { /* */ }
      try { refs.ppWet?.disconnect(); }  catch { /* */ }
    }, 1200);
  }

  ambientGain = null;
  lfo = null;
  lfoGainNode = null;
  satNode = null;
  convolver = null;
  reverbDryGain = null;
  reverbWetGain = null;
  pingPongInput = null;
  pingPongDelayL = null;
  pingPongDelayR = null;
  pingPongFbL = null;
  pingPongFbR = null;
  pingPongPanL = null;
  pingPongPanR = null;
  pingPongWet = null;
  electricPianoWave = null;
}

export function pauseAmbient(): void {
  if (!running || paused) return;
  paused = true;

  if (currentTheme === 'pulse') {
    stopBeatClock();
  } else {
    for (const t of voiceTimers) clearTimeout(t);
    voiceTimers = [];
  }

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

  if (currentTheme === 'pulse') {
    startBeatClock();
  } else {
    voiceTimers = [];
    startVoiceTimers(600);
  }
}

/**
 * Switch music style on the fly with a soft crossfade.
 *
 * A4 crossfade design:
 * - Old voice timers self-terminate via themeGeneration guard — their in-flight notes
 *   ring out naturally (no hard cut). Beat clock is explicitly stopped (interval-based).
 * - Effect chain is rebuilt with a 60ms mute window to prevent any click from
 *   the wet/dry routing change during teardown+rebuild.
 * - New theme voices start staggered at 200ms, overlapping with the old fade-out.
 *
 * Result: ~200ms soft blend rather than a hard gap on theme switch.
 */
export function setMusicTheme(theme: MusicTheme): void {
  if (theme === currentTheme) return;

  const prevTheme = currentTheme;
  currentTheme = theme;
  arpIndex = 0;
  lofiArpFireCount = 0;
  motifPos = 0;
  markovPrev1 = -1;
  markovPrev2 = -1;
  lastNotePerVoice.clear();

  if (!running || paused) return;

  // Stop beat clock if leaving pulse (interval-based, must be cancelled explicitly)
  if (prevTheme === 'pulse') stopBeatClock();

  // Bump generation — old voice timer callbacks check this and self-terminate
  themeGeneration++;

  if (ambientGain) {
    const ac = getCtx();
    const now = ac.currentTime;
    // Brief 60ms mute prevents any routing click during effect chain rebuild
    ambientGain.gain.cancelScheduledValues(now);
    ambientGain.gain.setValueAtTime(ambientGain.gain.value, now);
    ambientGain.gain.linearRampToValueAtTime(0.0001, now + 0.02);
    setTimeout(() => {
      if (!running) return;
      tearDownEffectChain();
      buildEffectChain(getCtx(), getMaster());
      // Fade back in over 200ms — new voices start during this ramp
      const t2 = getCtx().currentTime;
      ambientGain?.gain.setValueAtTime(0.0001, t2);
      ambientGain?.gain.linearRampToValueAtTime(AMBIENT_BASE_VOL, t2 + 0.2);
    }, 25); // 25ms after mute starts
  }

  if (theme === 'pulse') {
    startBeatClock();
  } else {
    startVoiceTimers(200); // start immediately, overlap with old notes fading
  }
}

/**
 * Attempt to snap the beat clock to the player's detected rhythm period.
 * Called after each piece placement. If the autocorrelation over recent IOIs
 * finds a clear periodicity (≥75% match), the beat clock snaps to that tempo.
 * This creates a flow-state moment when the player's natural rhythm locks with the music.
 * Only affects the pulse theme beat clock (other themes use voice timers, not a grid).
 */
export function lockRhythmPeriod(): void {
  if (currentTheme !== 'pulse' || !running || paused || beatClockTimer === null) return;
  const detected = detectRhythmPeriod();
  if (detected === null) return;
  // Convert detected period (ms) to quarter-note duration, clamped to BPM range
  const detectedBeatSec = detected / 1000;
  const bpm = 60 / detectedBeatSec;
  if (bpm < 80 || bpm > 140) return; // outside range — ignore
  const prev = beatDuration;
  beatDuration = detectedBeatSec;
  // Only update if meaningfully different (>3% change) to avoid micro-jitter
  if (Math.abs(beatDuration - prev) / prev < 0.03) { beatDuration = prev; }
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

  // Sync beat clock tempo to new pace
  if (currentTheme === 'pulse' && beatClockTimer !== null) {
    beatDuration = deriveBeatDuration(paceMs);
  }

  // Sync ping-pong delay time to new pace
  if (currentTheme === 'ambient' && pingPongDelayL && pingPongDelayR) {
    const delayTime = Math.max(0.1, Math.min(1.2, paceMs / 3000));
    pingPongDelayL.delayTime.linearRampToValueAtTime(delayTime, now + 0.5);
    pingPongDelayR.delayTime.linearRampToValueAtTime(delayTime, now + 0.5);
  }
}

export function setAmbientTension(t: number): void {
  tension = Math.max(0, Math.min(1, t));
  const tier = getTensionTier(tension);
  if (tier !== prevTensionTier) {
    prevTensionTier = tier;
    if (running && !paused) morphReverb(tier);
  }
  updateBinauralBeat(tension);
}

export function setAmbientStreak(s: number): void {
  streak = Math.max(0, s);
}

/**
 * Briefly duck the music volume when a prominent SFX fires.
 * @param amount     - target as fraction of AMBIENT_BASE_VOL (0.5 = 50% level)
 * @param durationSec - total duration including recovery
 */
export function duckMusic(amount: number = 0.5, durationSec: number = 0.3): void {
  if (!ambientGain || !running || paused) return;
  const ac = getCtx();
  const now = ac.currentTime;
  // Keep target above LFO swing floor to avoid phase inversion
  const target = Math.max(AMBIENT_BASE_VOL * Math.max(amount, 0.45), LFO_DEPTH + 0.005);
  ambientGain.gain.cancelScheduledValues(now);
  ambientGain.gain.setValueAtTime(ambientGain.gain.value, now);
  ambientGain.gain.linearRampToValueAtTime(target, now + 0.025);
  ambientGain.gain.linearRampToValueAtTime(AMBIENT_BASE_VOL, now + durationSec);
}

/** Current chord root frequency — used by SFX for harmonic alignment. */
export function getCurrentChordRoot(): number {
  return currentChord.root;
}

/** All tone frequencies of the current chord — used by chord-aware SFX. */
export function getCurrentChordTones(): number[] {
  return currentChord.tones;
}

/** Current tension value (0–1) — used by SFX to adapt timbre. */
export function getAmbientTension(): number {
  return tension;
}

/** Whether ambient music is actively playing (not stopped or paused). */
export function isAmbientRunning(): boolean {
  return running && !paused;
}

// ─── Event-driven musical stingers (#21) ──────────────────────

/**
 * Schedule brief oscillator notes starting at startTime.
 * Notes are staggered by stagger seconds (0 = simultaneous chord bloom).
 */
function scheduleStinger(
  freqs: number[],
  startTime: number,
  vol: number,
  noteDur: number,
  stagger: number = 0,
): void {
  if (!ambientGain) return;
  const ac = getCtx();
  freqs.forEach((freq, i) => {
    const t = startTime + i * stagger;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + noteDur);
    osc.connect(gain);
    gain.connect(ambientGain!);
    osc.start(t);
    osc.stop(t + noteDur + 0.05);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  });
}

export type MusicEvent = 'allClear' | 'revive' | 'gameOver';

/**
 * Trigger a harmonically-aligned music stinger on a game event.
 * Snaps to the next 16th-note grid position for musical timing.
 * Only fires when music is running and not paused.
 */
export function triggerMusicEvent(event: MusicEvent): void {
  if (!ambientGain || !running || paused) return;
  const ac = getCtx();
  const now = ac.currentTime;
  const sixteenth = beatDuration / 4;
  // Snap to next grid position (with tiny offset to avoid exact-0 edge)
  const nextGrid = Math.ceil((now + 0.01) / sixteenth) * sixteenth;
  const root = currentChord.root;

  switch (event) {
    case 'allClear':
      // Chord bloom: all tones of current chord, simultaneous, long sustain
      scheduleStinger(currentChord.tones.slice(0, 4), nextGrid, 0.028, 0.7, 0);
      break;
    case 'revive':
      // Rising 5th from chord root — "second chance" harmonic signal
      scheduleStinger([root * 2, root * 3, root * 4], nextGrid, 0.030, 0.08, 0.055);
      break;
    case 'gameOver':
      // Descend from chord root — musical echo of the SFX descent
      scheduleStinger([root * 4, root * 3, root * 2, root], nextGrid, 0.025, 0.14, 0.12);
      break;
  }
}

/**
 * Brief harmonic ring above the current chord root — fired at streak milestones (3, 5, 8, 11+).
 * Fires harmonics 2f, 3f, ... up to min(streakLevel, 5) partials above the chord root,
 * each at 1/n volume and staggered 10ms. Sounds like touching a resonant surface.
 */
export function triggerStreakShimmer(streakLevel: number): void {
  if (!ambientGain || !running || paused) return;
  const ac = getCtx();
  const t = ac.currentTime;
  const root = currentChord.root;
  const harmonicCount = Math.min(streakLevel - 1, 5); // 2 at streak 3, 5 at streak 6+
  const baseVol = Math.min(0.018 + streakLevel * 0.004, 0.045);

  for (let i = 0; i < harmonicCount; i++) {
    const n = i + 2; // partials 2, 3, 4, 5, 6
    const freq = Math.min(root * n, 2000); // cap at 2kHz for phone speakers
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const startT = t + i * 0.01;
    gain.gain.setValueAtTime(0, startT);
    gain.gain.linearRampToValueAtTime(baseVol / n, startT + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, startT + 0.4 + i * 0.05);
    osc.connect(gain);
    gain.connect(ambientGain!);
    osc.start(startT);
    osc.stop(startT + 0.6);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
}
