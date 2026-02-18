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

export type MusicTheme = 'ambient' | 'pulse' | 'lofi';

// ─── Frequency table ──────────────────────────────────────────

const NOTE = {
  C4: 261.63, E4: 329.63, G4: 392.00, A4: 440.00,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
  C6: 1046.50,
} as const;

// ─── Chord progression system ─────────────────────────────────
//
// Each chord is a set of "valid" frequencies voices should prefer.
// The progression advances every CHORD_DURATION_SEC.
// Calm progression: I → VI → IV → II (circular)
// Tense progression (tension > 0.6): I → VIm → IVsus → V

type Chord = { name: string; root: number; tones: number[] };

const PROGRESSION_CALM: Chord[] = [
  { name: 'I',  root: NOTE.C4, tones: [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6] },
  { name: 'VI', root: NOTE.A4, tones: [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.A5] },
  { name: 'IV', root: NOTE.G4, tones: [NOTE.G4, NOTE.C5, NOTE.D5, NOTE.G5] },
  { name: 'II', root: NOTE.E4, tones: [NOTE.E4, NOTE.G4, NOTE.A4, NOTE.E5, NOTE.G5] },
];

const PROGRESSION_TENSE: Chord[] = [
  { name: 'I',     root: NOTE.C4, tones: [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5] },
  { name: 'VIm',   root: NOTE.A4, tones: [NOTE.A4, NOTE.C5, NOTE.E5] },
  { name: 'IVsus', root: NOTE.G4, tones: [NOTE.G4, NOTE.C5, NOTE.D5] },
  { name: 'V',     root: NOTE.D5, tones: [NOTE.D5, NOTE.A5, NOTE.C6] },
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
 * Schedule all pulse voices that fall on this eighth-note grid position.
 * Uses AudioContext startTime (not setTimeout) so notes lock to the grid exactly.
 */
function scheduleBeatEvents(beatTime: number): void {
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
 * Advance the chord progression if CHORD_DURATION_SEC has elapsed.
 * Switches to tense progression when tension > 0.6.
 */
function updateChord(): void {
  const nowSec = Date.now() / 1000;
  if (nowSec - chordStartSec < CHORD_DURATION_SEC) return;

  const progression = tension > 0.6 ? PROGRESSION_TENSE : PROGRESSION_CALM;
  chordIndex = (chordIndex + 1) % progression.length;
  currentChord = progression[chordIndex];
  chordStartSec = nowSec;
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
    default:      return VOICES_AMBIENT;
  }
}

/**
 * Get the next arp note, cycling through the chord-filtered pool sequentially.
 * The arp traverses the scale rather than voice-leading — it's intentionally
 * a "running" voice. It still respects the current chord.
 */
function getArpNote(cfg: VoiceConfig): number {
  updateChord();
  const pool = tension > 0.5 ? cfg.tensePool : cfg.calmPool;
  const chordPool = pool.filter(f => currentChord.tones.some(ct => sameHarmonic(f, ct)));
  const activePool = chordPool.length > 0 ? chordPool : pool;
  const note = activePool[arpIndex % activePool.length];
  arpIndex++;
  return note;
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

  // Route: ambient arp → ping-pong input; everything else → ambientGain directly
  const dest = (cfg.name === 'arp' && currentTheme === 'ambient' && pingPongInput)
    ? pingPongInput
    : ambientGain!;
  panner.connect(dest);

  osc.connect(gain);
  osc.start(t);
  osc.stop(t + totalDur + 0.05);

  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
    padFilter?.disconnect();
    panner.disconnect();
    if (wowLfo)     { try { wowLfo.stop(); }     catch { /* */ } wowLfo.disconnect(); }
    if (wowGain)    { wowGain.disconnect(); }
    if (flutterLfo) { try { flutterLfo.stop(); } catch { /* */ } flutterLfo.disconnect(); }
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
    case 'shimmer':  return 1.0 - t * 0.5;
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

/**
 * setTimeout-based voice scheduler for ambient + lo-fi themes.
 * Pulse theme uses startBeatClock() instead.
 */
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
    const freq = isArp ? getArpNote(cfg) : pickChordNote(cfg);

    if (cfg.karplus) {
      karplusPluck(freq, cfg.baseVol * volMult, cfg.pan ?? 0);
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

  voiceTimers[idx] = setTimeout(() => scheduleVoice(idx), interval);
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

  // Initialise chord state
  chordIndex = 0;
  currentChord = PROGRESSION_CALM[0];
  chordStartSec = Date.now() / 1000;
  lastNotePerVoice.clear();
  lofiArpFireCount = 0;
  arpIndex = 0;

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
 * Switch music style on the fly. Old notes fade naturally.
 * Rebuilds effect chain, restarts appropriate scheduler.
 */
export function setMusicTheme(theme: MusicTheme): void {
  if (theme === currentTheme) return;
  currentTheme = theme;
  arpIndex = 0;
  lofiArpFireCount = 0;
  lastNotePerVoice.clear();

  if (!running || paused) return;

  stopBeatClock();
  for (const t of voiceTimers) clearTimeout(t);
  voiceTimers = [];

  if (ambientGain) {
    tearDownEffectChain();
    buildEffectChain(getCtx(), getMaster());
  }

  if (theme === 'pulse') {
    startBeatClock();
  } else {
    startVoiceTimers(300);
  }
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

/** Whether ambient music is actively playing (not stopped or paused). */
export function isAmbientRunning(): boolean {
  return running && !paused;
}
