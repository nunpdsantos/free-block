/**
 * Web Audio API synthesizer for musical game sounds.
 *
 * Design philosophy (from puzzle game audio research):
 * - Warm, gentle tones — sine/triangle waves, never square/sawtooth
 * - Pentatonic scale — notes that always sound consonant together
 * - Ascending scale on combos (Candy Crush semitone technique)
 * - Soft tactile "thock" for placement, crystalline chimes for clears
 * - Nothing harsh or fatiguing on phone speakers
 *
 * Key constraints (Audiokinetic smartphone research):
 * - Phone speakers roll off hard below 400 Hz
 * - Peak sensitivity: 1-4 kHz
 * - Usable range: 400 Hz – 10 kHz
 * - All reward tones should sit in 500-1500 Hz sweet spot
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let analyser: AnalyserNode | null = null;

export function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();

    // Master bus compressor: prevents SFX from clipping over music when events stack.
    // Soft-knee 4:1 ratio — transparent at normal levels, catches transient peaks.
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 6;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.15;

    masterGain.connect(compressor);
    compressor.connect(ctx.destination);

    // Analyser tap — side-chain read of output energy for visual feedback
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    compressor.connect(analyser); // reads energy; no output connection needed
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function getMaster(): GainNode {
  getCtx();
  return masterGain!;
}

/** Returns the AnalyserNode tapping the master bus — used by visuals to read audio energy. */
export function getAnalyserNode(): AnalyserNode | null {
  return analyser;
}

/** Set master volume (0.0 to 1.0). Applies to all subsequent and currently playing sounds. */
export function setMasterVolume(vol: number): void {
  getCtx();
  if (masterGain) {
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), ctx!.currentTime);
  }
}

// Clear/reward scale — C major pentatonic starting at C5 (phone speaker sweet spot)
const CLEAR_SCALE = [
  523.25,  // C5
  587.33,  // D5
  659.25,  // E5
  783.99,  // G5
  880.00,  // A5
  1046.50, // C6
  1174.66, // D6
  1318.51, // E6
];

// Full pentatonic for chords (lower octave adds richness when layered)
const CHORD_NOTES = {
  C4: 261.63, E4: 329.63, G4: 392.00,
  C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.50,
};

/**
 * Core tone with ADSR envelope.
 * All nodes are cleaned up on end to prevent memory leaks.
 */
function tone(
  freq: number,
  type: OscillatorType,
  vol: number,
  attack: number,
  decay: number,
  release: number,
  delay: number = 0,
  detune: number = 0,
  extraDest?: AudioNode,
): void {
  const ac = getCtx();
  const t = ac.currentTime + delay;

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  if (detune) osc.detune.value = detune;

  // ADSR: 0 → peak → sustain (30% of peak) → 0
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(vol * 0.3, 0.0001),
    t + attack + decay,
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    t + attack + decay + release,
  );

  osc.connect(gain);
  gain.connect(getMaster());
  if (extraDest) gain.connect(extraDest);

  osc.start(t);
  osc.stop(t + attack + decay + release + 0.05);

  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

/**
 * Filtered noise burst for tactile impact feel.
 */
function noiseBurst(
  vol: number,
  duration: number,
  filterFreq: number,
  delay: number = 0,
  extraDest?: AudioNode,
): void {
  const ac = getCtx();
  const t = ac.currentTime + delay;

  const bufSize = Math.ceil(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const src = ac.createBufferSource();
  src.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.5;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(getMaster());
  if (extraDest) gain.connect(extraDest);

  src.start(t);
  src.stop(t + duration + 0.01);

  src.onended = () => { src.disconnect(); filter.disconnect(); gain.disconnect(); };
}

// ─── Public API ────────────────────────────────────────────

/**
 * Deterministic impact click — a single damped cosine impulse at 800 Hz, 3ms.
 * A half-sine window gives clean onset and offset without spectral leakage.
 * At -18dB under the main placement sound, it's felt as "snap" rather than heard as pitch.
 */
function impactClick(freq: number, vol: number, delay = 0): void {
  const ac = getCtx();
  const t = ac.currentTime + delay;
  const sampleCount = Math.ceil(ac.sampleRate * 0.003); // 3ms
  const buf = ac.createBuffer(1, sampleCount, ac.sampleRate);
  const data = buf.getChannelData(0);
  const cyclesIn3ms = freq * 0.003;
  for (let i = 0; i < sampleCount; i++) {
    const phase = (i / sampleCount) * Math.PI * 2 * cyclesIn3ms;
    const env = Math.sin(Math.PI * i / sampleCount); // half-sine window
    data[i] = Math.cos(phase) * env;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const gain = ac.createGain();
  gain.gain.value = vol;
  src.connect(gain);
  gain.connect(getMaster());
  src.start(t);
  src.onended = () => { src.disconnect(); gain.disconnect(); };
}

/**
 * Soft woody "thock" when a piece lands on the board.
 * 4 layers: deterministic impact click + noise burst (contact texture) + triangle body + sine sub.
 * ±10 cents random detune prevents ear fatigue from repetition.
 * Total duration: ~110ms.
 */
export function synthPlace(dangerLevel: number = 0): void {
  const drift = (Math.random() - 0.5) * 30; // ±15 cents variation
  const volVar = 0.94 + Math.random() * 0.12; // ±1.5 dB volume variation
  // Deterministic click — single damped cosine impulse gives professional "snap" character
  impactClick(800, 0.04);
  // Warm noise burst — bandpass at 1200Hz for woody "contact" texture
  noiseBurst(0.08 * volVar, 0.03, 1200);
  // Triangle body — 350Hz is in the low-mid "weight" range, audible on phones
  tone(350, 'triangle', 0.1 * volVar, 0.004, 0.05, dangerLevel >= 2 ? 0.03 : 0.06, 0, drift);

  // Sub layer — drop entirely when board is critical (danger 2), thin at warning (danger 1)
  if (dangerLevel < 1) {
    tone(330, 'sine', 0.055 * volVar, 0.003, 0.03, 0.04, 0, drift);
  } else if (dangerLevel < 2) {
    tone(330, 'sine', 0.03 * volVar, 0.003, 0.02, 0.02, 0, drift);
  }

  // Locking snap — unchanged, always present
  noiseBurst(0.06 * volVar, 0.012, 600, 0.005);
  tone(420, 'triangle', 0.07 * volVar, 0.002, 0.015, dangerLevel >= 2 ? 0.012 : 0.025, 0.004, drift);
}

/**
 * Crystalline chime on line clear.
 * Uses C major pentatonic starting at C5 (523Hz) — phone speaker sweet spot.
 * Single clear: ascending 2-note pair (root → next) — signals "success" better than a lone note.
 * Multi-clear: rapid ascending arpeggio (Candy Crush technique) with a warm sweep.
 * Combo streak: starts higher on the scale each consecutive clear.
 * Total duration: single ~350ms, multi ~450ms.
 */
export function synthClear(combo: number, linesCleared: number, chordRoot?: number): void {
  let baseIdx = Math.min(combo, CLEAR_SCALE.length - 3);

  // Chord alignment: shift arp start to the scale step closest to the chord root.
  // Octave-normalise the root to the C5–C6 window, find the nearest pentatonic step,
  // then advance baseIdx (never retreat — preserves combo ascending feel).
  if (chordRoot !== undefined) {
    let r = chordRoot;
    while (r < CLEAR_SCALE[0]) r *= 2;
    while (r >= CLEAR_SCALE[0] * 2) r /= 2;
    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < 5; i++) {
      const d = Math.abs(r - CLEAR_SCALE[i]);
      if (d < minDist) { minDist = d; closestIdx = i; }
    }
    baseIdx = Math.min(Math.max(baseIdx, closestIdx), CLEAR_SCALE.length - 3);
  }
  // Volume variation per call (+/- ~1 dB) to prevent mechanical repetition
  const volVar = 0.95 + Math.random() * 0.1;

  if (linesCleared >= 2) {
    // Ascending arpeggio — one note per line cleared, 60ms apart
    const noteCount = Math.min(linesCleared + 1, 5);
    for (let i = 0; i < noteCount; i++) {
      const idx = Math.min(baseIdx + i, CLEAR_SCALE.length - 1);
      const d = i * 0.06;
      const freq = CLEAR_SCALE[idx];

      // Main chime: triangle wave for warm body
      tone(freq, 'triangle', 0.14 * volVar, 0.006, 0.14, 0.22, d);
      // Shimmer: capped at 2kHz to avoid harshness, volume fades as freq rises
      const shimmerFreq = Math.min(freq * 2, 2000);
      const shimmerVol = freq > 800 ? 0.015 : 0.03;
      tone(shimmerFreq, 'sine', shimmerVol * volVar, 0.01, 0.08, 0.14, d);
      // Warmth: slight 6-cent detune for chorus effect
      tone(freq, 'sine', 0.02 * volVar, 0.01, 0.1, 0.16, d, 6);

      // Combo 3+: wider chorus (second detuned voice)
      if (combo >= 3) {
        tone(freq, 'sine', 0.015 * volVar, 0.01, 0.1, 0.16, d, -8);
      }
    }
    // Warm sweep noise — bandpass at 1800Hz for a "whoosh" texture
    noiseBurst(0.03, 0.06, 1800);
    // Soft high sparkle — gentle, not piercing
    noiseBurst(0.015, 0.03, 2800, 0.04);

    // Combo 5+: sparkle noise burst for extra brilliance
    if (combo >= 5) {
      noiseBurst(0.02, 0.035, 2200, 0.08);
    }
    // Combo 7+: bass foundation — one octave below root for depth
    if (combo >= 7) {
      const bassFreq = CLEAR_SCALE[baseIdx] * 0.5;
      tone(bassFreq, 'triangle', 0.06 * volVar, 0.01, 0.15, 0.25);
    }
  } else {
    // Single clear: ascending 2-note pair (root → one step up)
    const freq1 = CLEAR_SCALE[baseIdx];
    const freq2 = CLEAR_SCALE[Math.min(baseIdx + 1, CLEAR_SCALE.length - 1)];

    // First note — warm body
    tone(freq1, 'triangle', 0.12 * volVar, 0.006, 0.1, 0.16);
    tone(freq1, 'sine', 0.02 * volVar, 0.01, 0.08, 0.12, 0, 5);

    // Second note — brighter, resolves upward (feels like completion)
    tone(freq2, 'triangle', 0.13 * volVar, 0.006, 0.12, 0.2, 0.07);
    const shimmerFreq = Math.min(freq2 * 2, 2000);
    tone(shimmerFreq, 'sine', 0.025 * volVar, 0.01, 0.06, 0.1, 0.07);
    tone(freq2, 'sine', 0.018 * volVar, 0.01, 0.09, 0.13, 0.07, 5);

    // Subtle sweep for satisfying texture
    noiseBurst(0.018, 0.04, 1500, 0.02);

    // Combo 3+: wider chorus on the resolution note
    if (combo >= 3) {
      tone(freq2, 'sine', 0.012 * volVar, 0.01, 0.08, 0.12, 0.07, -8);
    }
    // Combo 5+: sparkle noise
    if (combo >= 5) {
      noiseBurst(0.015, 0.025, 2200, 0.1);
    }
  }
}

/**
 * Harmonic series ring on all-clear (empty board).
 * Partials 2–9 of C3 root (130.81 Hz): integer multiples fuse perceptually into a
 * single ringing object — a bell or tuning fork rather than four separate synthesizer voices.
 * Amplitude falls as 1/n so high partials shimmer without harshness.
 * Slight stagger (25ms per partial) creates a natural ring-out cascade.
 * Total duration: ~850ms ring-out (+ natural partial decay).
 */
export function synthAllClear(): void {
  const root = 130.81; // C3 — integer partials land on C major chord members
  for (let n = 2; n <= 9; n++) {
    const freq = root * n;
    const amp = 0.18 / n; // natural 1/n falloff
    const delay = (n - 2) * 0.025; // stagger: high partials bloom after the fundamental
    tone(freq, 'sine', amp, 0.008, 0.2, 0.55, delay);
  }
  // Triangle sub on C4 for warm body on phone speakers
  tone(root * 2, 'triangle', 0.06, 0.01, 0.3, 0.7, 0);
  // Noise shimmer for contact texture
  noiseBurst(0.02, 0.04, 2400, 0.05);
}

/**
 * Gentle descending tone on game over.
 * Default: A5 → G5 → E5 → C5. When chordRoot provided, descent starts
 * from the nearest pentatonic step to that root so it stays in key.
 * Each step adds a soft sub layer one octave below for depth.
 * Total duration: ~1000ms.
 */
export function synthGameOver(chordRoot?: number): void {
  // Build 4-note descent starting from closest pentatonic step to chord root
  const PENTA = CLEAR_SCALE.slice(0, 6); // C5 D5 E5 G5 A5 C6
  let startIdx = 4; // default: A5
  if (chordRoot !== undefined) {
    let r = chordRoot;
    while (r < PENTA[0]) r *= 2;
    while (r >= PENTA[0] * 2) r /= 2;
    const closestIdx = PENTA.reduce((bi, f, i) =>
      Math.abs(f - r) < Math.abs(PENTA[bi] - r) ? i : bi, 0);
    startIdx = Math.max(3, closestIdx); // at least G5 so descent has room
  }
  const notes = [0, -1, -2, -3].map(offset => PENTA[startIdx + offset]);

  notes.forEach((freq, i) => {
    const d = i * 0.18;
    const v = 0.11 - i * 0.015;
    tone(freq, 'triangle', Math.max(v, 0.04), 0.02, 0.22, 0.4, d);
    // Sub layer one octave down — harmonics still reach phone speakers
    tone(freq * 0.5, 'sine', 0.03, 0.025, 0.15, 0.3, d);
  });
}

/**
 * Ascending tone on revive — "second chance" feel.
 * Major arpeggio (C5→E5→G5) at low tension; minor (C5→Eb5→G5) at high tension.
 * AM tremolo shimmer added on the final note for "power surge" sensation.
 * Total duration: ~550ms.
 */
export function synthRevive(reviveTension: number = 0): void {
  const ac = getCtx();
  // High tension → narrow escape (minor 3rd); calm → triumphant (major 3rd)
  const notes = reviveTension > 0.6
    ? [523.25, 622.25, 783.99] // C5, Eb5, G5
    : [523.25, 659.25, 783.99]; // C5, E5, G5

  notes.forEach((freq, i) => {
    const d = i * 0.08;
    const v = 0.09 + i * 0.015;
    tone(freq, 'triangle', v, 0.008, 0.12, 0.25, d);
    const shimmerFreq = Math.min(freq * 2, 2000);
    tone(shimmerFreq, 'sine', 0.02, 0.01, 0.08, 0.15, d + 0.01);
  });
  noiseBurst(0.02, 0.04, 1600, 0.2);

  // AM tremolo overlay on final note — begins in its decay tail (power-surge feel)
  const tFinal = ac.currentTime + 2 * 0.08 + 0.25; // 0.25s into final note's sustain
  const finalFreq = notes[2];
  const tOsc = ac.createOscillator();
  const tEnv = ac.createGain();
  const treOsc = ac.createOscillator();
  const treGain = ac.createGain();

  tOsc.type = 'triangle';
  tOsc.frequency.value = finalFreq;
  treOsc.type = 'sine';
  treOsc.frequency.value = 4; // 4 Hz AM tremolo
  treGain.gain.value = 0.018;
  treOsc.connect(treGain);
  treGain.connect(tEnv.gain); // modulates envelope amplitude

  tEnv.gain.setValueAtTime(0.0001, tFinal);
  tEnv.gain.linearRampToValueAtTime(0.032, tFinal + 0.02);
  tEnv.gain.exponentialRampToValueAtTime(0.0001, tFinal + 0.30);

  tOsc.connect(tEnv);
  tEnv.connect(getMaster());
  tOsc.start(tFinal);
  tOsc.stop(tFinal + 0.35);
  treOsc.start(tFinal);
  treOsc.stop(tFinal + 0.35);

  tOsc.onended = () => {
    tOsc.disconnect(); tEnv.disconnect();
    treOsc.disconnect(); treGain.disconnect();
  };
}

/**
 * Score milestone fanfare — rising C5→E5→G5 arpeggio with shimmer.
 * Lighter than synthAchievement (no reverb tail), distinct from synthClear.
 * Fires on score milestones (1k, 2.5k, 5k, 10k…).
 * Total duration: ~500ms.
 */
export function synthMilestone(): void {
  const notes = [CHORD_NOTES.C5, CHORD_NOTES.E5, CHORD_NOTES.G5];
  notes.forEach((freq, i) => {
    const d = i * 0.12;
    tone(freq, 'triangle', 0.11, 0.008, 0.1, 0.18, d);
    const shimmerFreq = Math.min(freq * 2, 2000);
    tone(shimmerFreq, 'sine', 0.018, 0.01, 0.06, 0.12, d + 0.01);
  });
  noiseBurst(0.015, 0.03, 2000, 0.28);
}

/**
 * Achievement unlock fanfare — celebratory "ding-DING!-C6" with reverb tail.
 * C5 → G5 → C6 (rising octave resolution) with E5 inner voice and sparkle.
 * All voices routed through a 1.5s algorithmic reverb send (prestigious ring-out).
 * Total duration: ~900ms (+ reverb tail).
 */
export function synthAchievement(): void {
  const ac = getCtx();

  // Reverb tail: 1.5s algorithmic room, 0.4 wet — achievement deserves to linger
  const conv = ac.createConvolver();
  const convGain = ac.createGain();
  convGain.gain.value = 0.4;
  const irLen = Math.ceil(ac.sampleRate * 1.5);
  const ir = ac.createBuffer(2, irLen, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < irLen; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 4);
    }
  }
  conv.buffer = ir;
  conv.connect(convGain);
  convGain.connect(getMaster());
  setTimeout(() => { try { conv.disconnect(); convGain.disconnect(); } catch { /* */ } }, 3000);

  // First note — C5, warm body
  tone(CHORD_NOTES.C5, 'triangle', 0.13, 0.006, 0.1, 0.2, 0, 0, conv);
  tone(CHORD_NOTES.C5, 'sine', 0.03, 0.01, 0.08, 0.15, 0, 5, conv);

  // Second note — G5, brighter and louder (the "DING")
  tone(CHORD_NOTES.G5, 'triangle', 0.16, 0.006, 0.15, 0.35, 0.09, 0, conv);
  tone(CHORD_NOTES.G5, 'sine', 0.035, 0.01, 0.1, 0.25, 0.09, 6, conv);

  // Layered 3rd (E5) — fills out the chord subtly
  tone(CHORD_NOTES.E5, 'sine', 0.04, 0.01, 0.12, 0.28, 0.09, 0, conv);

  // Shimmer overtone on the resolution
  tone(Math.min(CHORD_NOTES.G5 * 2, 2000), 'sine', 0.02, 0.015, 0.08, 0.2, 0.1, 0, conv);

  // C6 completion sparkle — resolves the fanfare up the octave
  tone(CHORD_NOTES.C6, 'triangle', 0.065, 0.008, 0.06, 0.30, 0.40, 0, conv);
  tone(Math.min(CHORD_NOTES.C6 * 2, 2000), 'sine', 0.016, 0.01, 0.04, 0.18, 0.40, 0, conv);

  // Sparkle noise
  noiseBurst(0.025, 0.04, 2400, 0.08, conv);
  noiseBurst(0.015, 0.03, 3200, 0.14, conv);
}
