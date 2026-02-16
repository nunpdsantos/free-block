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

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
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
  gain.connect(ac.destination);

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
  gain.connect(ac.destination);

  src.start(t);
  src.stop(t + duration + 0.01);

  src.onended = () => { src.disconnect(); filter.disconnect(); gain.disconnect(); };
}

// ─── Public API ────────────────────────────────────────────

/**
 * Soft woody "thock" when a piece lands on the board.
 * 3 layers: noise burst (contact texture) + triangle body + sine sub.
 * ±10 cents random detune prevents ear fatigue from repetition.
 * Total duration: ~110ms.
 */
export function synthPlace(): void {
  const drift = (Math.random() - 0.5) * 20; // ±10 cents variation
  // Warm noise burst — bandpass at 1200Hz for woody "contact" texture
  noiseBurst(0.08, 0.03, 1200);
  // Triangle body — 350Hz is in the low-mid "weight" range, audible on phones
  tone(350, 'triangle', 0.1, 0.004, 0.05, 0.06, 0, drift);
  // Sine sub-body for warmth (harmonics at 440/660Hz reach phone speakers)
  tone(220, 'sine', 0.06, 0.003, 0.03, 0.04, 0, drift);
  // Locking snap — low-pitched mechanical click (piece snapping into place)
  noiseBurst(0.06, 0.012, 600, 0.005);
  tone(420, 'triangle', 0.07, 0.002, 0.015, 0.025, 0.004, drift);
}

/**
 * Crystalline chime on line clear.
 * Uses C major pentatonic starting at C5 (523Hz) — phone speaker sweet spot.
 * Single clear: ascending 2-note pair (root → next) — signals "success" better than a lone note.
 * Multi-clear: rapid ascending arpeggio (Candy Crush technique) with a warm sweep.
 * Combo streak: starts higher on the scale each consecutive clear.
 * Total duration: single ~350ms, multi ~450ms.
 */
export function synthClear(combo: number, linesCleared: number): void {
  const baseIdx = Math.min(combo, CLEAR_SCALE.length - 3);

  if (linesCleared >= 2) {
    // Ascending arpeggio — one note per line cleared, 60ms apart
    const noteCount = Math.min(linesCleared + 1, 5);
    for (let i = 0; i < noteCount; i++) {
      const idx = Math.min(baseIdx + i, CLEAR_SCALE.length - 1);
      const d = i * 0.06;
      const freq = CLEAR_SCALE[idx];

      // Main chime: triangle wave for warm body
      tone(freq, 'triangle', 0.14, 0.006, 0.14, 0.22, d);
      // Shimmer: capped at 2kHz to avoid harshness, volume fades as freq rises
      const shimmerFreq = Math.min(freq * 2, 2000);
      const shimmerVol = freq > 800 ? 0.015 : 0.03;
      tone(shimmerFreq, 'sine', shimmerVol, 0.01, 0.08, 0.14, d);
      // Warmth: slight 6-cent detune for chorus effect
      tone(freq, 'sine', 0.02, 0.01, 0.1, 0.16, d, 6);
    }
    // Warm sweep noise — bandpass at 1800Hz for a "whoosh" texture
    noiseBurst(0.03, 0.06, 1800);
    // Soft high sparkle — gentle, not piercing
    noiseBurst(0.015, 0.03, 2800, 0.04);
  } else {
    // Single clear: ascending 2-note pair (root → one step up)
    const freq1 = CLEAR_SCALE[baseIdx];
    const freq2 = CLEAR_SCALE[Math.min(baseIdx + 1, CLEAR_SCALE.length - 1)];

    // First note — warm body
    tone(freq1, 'triangle', 0.12, 0.006, 0.1, 0.16);
    tone(freq1, 'sine', 0.02, 0.01, 0.08, 0.12, 0, 5);

    // Second note — brighter, resolves upward (feels like completion)
    tone(freq2, 'triangle', 0.13, 0.006, 0.12, 0.2, 0.07);
    const shimmerFreq = Math.min(freq2 * 2, 2000);
    tone(shimmerFreq, 'sine', 0.025, 0.01, 0.06, 0.1, 0.07);
    tone(freq2, 'sine', 0.018, 0.01, 0.09, 0.13, 0.07, 5);

    // Subtle sweep for satisfying texture
    noiseBurst(0.018, 0.04, 1500, 0.02);
  }
}

/**
 * Triumphant major chord on all-clear (empty board).
 * C major: root (C5) + 3rd (E5) + 5th (G5) + octave (C6).
 * Each voice gets a shimmer overtone. High sparkle notes on top.
 * Total duration: ~800ms ring-out.
 */
export function synthAllClear(): void {
  const chord = [
    CHORD_NOTES.C5,
    CHORD_NOTES.E5,
    CHORD_NOTES.G5,
    CHORD_NOTES.C6,
  ];

  chord.forEach((freq, i) => {
    const d = i * 0.035;
    tone(freq, 'triangle', 0.12, 0.01, 0.25, 0.55, d);
    // Shimmer capped — C6*2 would be 2093Hz, keep it gentle
    const shimmerFreq = Math.min(freq * 2, 2000);
    tone(shimmerFreq, 'sine', 0.025, 0.015, 0.15, 0.35, d + 0.02);
  });

  // Sparkle — using triangle instead of sine for softer overtones
  tone(CLEAR_SCALE[5], 'triangle', 0.04, 0.02, 0.12, 0.4, 0.12); // C6
  tone(CLEAR_SCALE[7], 'triangle', 0.025, 0.02, 0.1, 0.3, 0.18); // E6

  // Warm noise shimmer — lowered from 6kHz to 3.5kHz
  noiseBurst(0.02, 0.05, 3500, 0.05);
}

/**
 * Gentle descending tone on game over.
 * A5 → G5 → E5 → C5 — upper octave so it's audible on phone speakers.
 * Each step adds a soft sub layer one octave below for depth.
 * Total duration: ~1000ms.
 */
export function synthGameOver(): void {
  const notes = [880, 783.99, 659.25, 523.25]; // A5 G5 E5 C5
  notes.forEach((freq, i) => {
    const d = i * 0.18;
    const v = 0.11 - i * 0.015;
    tone(freq, 'triangle', Math.max(v, 0.04), 0.02, 0.22, 0.4, d);
    // Sub layer one octave down — harmonics still reach phone speakers
    tone(freq * 0.5, 'sine', 0.03, 0.025, 0.15, 0.3, d);
  });
}
